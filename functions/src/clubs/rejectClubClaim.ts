import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Club } from "../types/club";

/**
 * Story 2.2: Claim a Club - Reject
 *
 * Callable function for platform admin to reject a club claim.
 * Resets club status to 'unclaimed'.
 *
 * Lifecycle: claim_pending → unclaimed
 */

interface RejectClubClaimRequest {
  clubId: string;
  reason?: string; // Optional rejection reason for audit
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
 * Callable function to reject a club claim.
 *
 * Security: Requires platform admin (isPlatformAdmin claim).
 * Constraint: Club must be in 'claim_pending' status.
 *
 * Actions:
 * 1. Reset club status to 'unclaimed'
 * 2. Clear claimedBy field
 * 3. Write audit log
 */
export const rejectClubClaim = functions.https.onCall(
  async (data: RejectClubClaimRequest, context): Promise<{ success: boolean; message: string }> => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated to reject club claims"
      );
    }

    // 2. Verify caller is platform admin
    const callerToken = context.auth.token;
    if (!callerToken.isPlatformAdmin) {
      functions.logger.warn("Non-admin attempted to reject club claim", {
        callerId: context.auth.uid,
        clubId: data.clubId,
      });
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only platform admins can reject club claims"
      );
    }

    // 3. Validate request data
    if (!data.clubId || typeof data.clubId !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "clubId is required and must be a string"
      );
    }

    const adminId = context.auth.uid;
    const db = admin.firestore();
    const clubRef = db.collection("clubs").doc(data.clubId);

    try {
      // 4. Get club and validate status
      const clubDoc = await clubRef.get();

      if (!clubDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          `Club with id ${data.clubId} not found`
        );
      }

      const club = clubDoc.data() as Club;

      if (club.status !== "claim_pending") {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `Club is not pending approval. Current status: ${club.status}`
        );
      }

      const claimantId = club.claimedBy;
      const now = admin.firestore.Timestamp.now();

      // 5. Reset club to unclaimed
      await clubRef.update({
        status: "unclaimed",
        claimedBy: null,
        updatedAt: now,
      });

      functions.logger.info("Club claim rejected", {
        clubId: data.clubId,
        claimantId,
        adminId,
        clubName: club.name,
        reason: data.reason || "(no reason provided)",
      });

      // 6. Write audit log
      await writeAuditLog({
        action: "club.claim.rejected",
        actorId: adminId,
        actorType: "admin",
        targetType: "club",
        targetId: data.clubId,
        targetClubId: data.clubId,
        details: {
          clubName: club.name,
          claimantId,
          previousStatus: "claim_pending",
          newStatus: "unclaimed",
          reason: data.reason || null,
        },
        ipAddress: context.rawRequest?.ip || null,
      });

      return {
        success: true,
        message: `Club "${club.name}" claim rejected. Club is available for claiming again.`,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error("Failed to reject club claim", { error, clubId: data.clubId });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to reject club claim"
      );
    }
  }
);
