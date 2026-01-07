import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
  ConfirmRosterRequest,
  ConfirmRosterResponse,
  BoxerDataStatus,
} from "../types/boxer";

/**
 * Story 4.2: Confirm Roster
 *
 * Callable function for club members to confirm draft boxers.
 * Transitions boxers from 'draft' to 'active' status.
 *
 * Lifecycle: draft → active
 *
 * Constraints:
 * - Explicit boxer selection required (no "confirm all")
 * - All-or-nothing: if any boxer is invalid, entire request fails
 * - Only draft boxers can be confirmed
 */

interface AuditLogEntry {
  logId: string;
  action: string;
  actorId: string;
  actorType: "user" | "admin" | "system";
  targetType: string;
  targetId: string;
  targetClubId: string | null;
  details: Record<string, unknown>;
  timestamp: admin.firestore.Timestamp;
  ipAddress: string | null;
}

/**
 * Write an audit log entry for roster confirmation.
 */
async function writeAuditLog(
  entry: Omit<AuditLogEntry, "logId" | "timestamp">
): Promise<void> {
  const db = admin.firestore();
  const logRef = db.collection("admin").doc("auditLogs").collection("entries").doc();

  const fullEntry: AuditLogEntry = {
    ...entry,
    logId: logRef.id,
    timestamp: admin.firestore.Timestamp.now(),
  };

  await logRef.set(fullEntry);
  functions.logger.info("Audit log written", {
    logId: fullEntry.logId,
    action: entry.action,
  });
}

/**
 * Callable function to confirm draft boxers.
 *
 * Security: Requires authentication and club membership.
 *
 * Actions:
 * 1. Verify caller is authenticated
 * 2. Verify caller is a member of the target club
 * 3. Verify club exists and is claimed
 * 4. Validate all boxerIds belong to club and are in draft status
 * 5. Update each boxer's dataStatus to 'active'
 * 6. Write audit log
 */
export const confirmRoster = functions.https.onCall(
  async (
    data: ConfirmRosterRequest,
    context
  ): Promise<ConfirmRosterResponse> => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated to confirm roster"
      );
    }

    const userId = context.auth.uid;

    // 2. Validate request data
    if (!data.clubId || typeof data.clubId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "clubId is required and must be a string"
      );
    }

    if (!data.boxerIds || !Array.isArray(data.boxerIds)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "boxerIds is required and must be an array"
      );
    }

    if (data.boxerIds.length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "boxerIds array cannot be empty. At least one boxer must be selected."
      );
    }

    // Validate all boxerIds are strings
    for (const boxerId of data.boxerIds) {
      if (typeof boxerId !== "string" || boxerId.trim() === "") {
        throw new functions.https.HttpsError(
          "invalid-argument",
          "All boxerIds must be non-empty strings"
        );
      }
    }

    const { clubId, boxerIds } = data;
    const db = admin.firestore();

    // 3. Verify caller is a member of the club
    const memberRef = db
      .collection("clubs")
      .doc(clubId)
      .collection("members")
      .doc(userId);

    const memberDoc = await memberRef.get();

    if (!memberDoc.exists) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You must be a member of this club to confirm roster"
      );
    }

    // 4. Verify club exists and is claimed
    const clubRef = db.collection("clubs").doc(clubId);
    const clubDoc = await clubRef.get();

    if (!clubDoc.exists) {
      throw new functions.https.HttpsError(
        "not-found",
        `Club with id ${clubId} not found`
      );
    }

    const clubData = clubDoc.data();
    if (clubData?.status !== "claimed") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Club must be claimed before confirming roster"
      );
    }

    // 5. Validate all boxers exist, belong to club, and are in draft status
    const boxersRef = db.collection("clubs").doc(clubId).collection("boxers");
    const boxerDocs: admin.firestore.DocumentSnapshot[] = [];

    for (const boxerId of boxerIds) {
      const boxerDoc = await boxersRef.doc(boxerId).get();

      if (!boxerDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          `Boxer with id ${boxerId} not found in club ${clubId}`
        );
      }

      const boxerData = boxerDoc.data();
      const dataStatus = boxerData?.dataStatus as BoxerDataStatus;

      if (dataStatus === "active") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Boxer ${boxerId} is already active and cannot be re-confirmed`
        );
      }

      if (dataStatus === "archived") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Boxer ${boxerId} is archived and cannot be confirmed`
        );
      }

      if (dataStatus !== "draft") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Boxer ${boxerId} has invalid status: ${dataStatus}`
        );
      }

      boxerDocs.push(boxerDoc);
    }

    // 6. Update all boxers using batched writes (max 500 per batch)
    const now = admin.firestore.Timestamp.now();
    const BATCH_SIZE = 500;

    try {
      for (let i = 0; i < boxerDocs.length; i += BATCH_SIZE) {
        const batch = db.batch();
        const batchDocs = boxerDocs.slice(i, i + BATCH_SIZE);

        for (const boxerDoc of batchDocs) {
          batch.update(boxerDoc.ref, {
            dataStatus: "active",
            updatedAt: now,
            lastModifiedBy: userId,
          });
        }

        await batch.commit();
      }

      functions.logger.info("Roster confirmed", {
        clubId,
        userId,
        confirmedCount: boxerIds.length,
        boxerIds,
      });

      // 7. Write audit log
      await writeAuditLog({
        action: "roster.confirmed",
        actorId: userId,
        actorType: "user",
        targetType: "club",
        targetId: clubId,
        targetClubId: clubId,
        details: {
          confirmedCount: boxerIds.length,
          boxerIds,
        },
        ipAddress: context.rawRequest?.ip || null,
      });

      return {
        success: true,
        confirmedCount: boxerIds.length,
        boxerIds,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error("Failed to confirm roster", {
        error,
        clubId,
        boxerIds,
      });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to confirm roster"
      );
    }
  }
);
