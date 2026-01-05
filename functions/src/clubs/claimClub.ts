import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Club } from "../types/club";

/**
 * Story 2.2: Claim a Club
 *
 * Callable function to submit a club claim request.
 * Sets club status to 'claim_pending' for admin approval.
 *
 * Lifecycle: unclaimed → claim_pending → (approved) claimed / (rejected) unclaimed
 */

interface ClaimClubRequest {
  clubId: string;
}

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
 * Write an audit log entry for club claim actions.
 */
async function writeAuditLog(entry: Omit<AuditLogEntry, "logId" | "timestamp">): Promise<void> {
  const db = admin.firestore();
  const logRef = db.collection("admin").doc("auditLogs").collection("entries").doc();

  const fullEntry: AuditLogEntry = {
    ...entry,
    logId: logRef.id,
    timestamp: admin.firestore.Timestamp.now(),
  };

  await logRef.set(fullEntry);
  functions.logger.info("Audit log written", { logId: fullEntry.logId, action: entry.action });
}

/**
 * Callable function to claim a club.
 *
 * Security: Requires authentication.
 * Constraint: Club must be in 'unclaimed' status.
 */
export const claimClub = functions.https.onCall(
  async (data: ClaimClubRequest, context): Promise<{ success: boolean; message: string }> => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated to claim a club"
      );
    }

    // 2. Validate request data
    if (!data.clubId || typeof data.clubId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "clubId is required and must be a string"
      );
    }

    const userId = context.auth.uid;
    const db = admin.firestore();
    const clubRef = db.collection("clubs").doc(data.clubId);

    try {
      // 3. Get club and validate status
      const clubDoc = await clubRef.get();

      if (!clubDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          `Club with id ${data.clubId} not found`
        );
      }

      const club = clubDoc.data() as Club;

      if (club.status !== "unclaimed") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Club is not available for claiming. Current status: ${club.status}`
        );
      }

      // 4. Update club to claim_pending
      const now = admin.firestore.Timestamp.now();
      await clubRef.update({
        status: "claim_pending",
        claimedBy: userId,
        updatedAt: now,
      });

      functions.logger.info("Club claim requested", {
        clubId: data.clubId,
        userId,
        clubName: club.name,
      });

      // 5. Write audit log
      await writeAuditLog({
        action: "club.claim.requested",
        actorId: userId,
        actorType: "user",
        targetType: "club",
        targetId: data.clubId,
        targetClubId: data.clubId,
        details: {
          clubName: club.name,
          previousStatus: "unclaimed",
          newStatus: "claim_pending",
        },
        ipAddress: context.rawRequest?.ip || null,
      });

      return {
        success: true,
        message: `Claim request submitted for ${club.name}. Awaiting admin approval.`,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error("Failed to claim club", { error, clubId: data.clubId });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to submit claim request"
      );
    }
  }
);
