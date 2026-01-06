import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Club } from "../types/club";

/**
 * Story 2.2: Claim a Club - Approve
 *
 * Callable function for platform admin to approve a club claim.
 * Sets club status to 'claimed', creates member document, updates user.
 *
 * Lifecycle: claim_pending → claimed
 */

interface ApproveClubClaimRequest {
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
 * Callable function to approve a club claim.
 *
 * Security: Requires platform admin (isPlatformAdmin claim).
 * Constraint: Club must be in 'claim_pending' status.
 *
 * Actions:
 * 1. Update club status to 'claimed'
 * 2. Create member document for claimant
 * 3. Update claimant's clubMemberships array
 * 4. Write audit log
 */
export const approveClubClaim = functions.https.onCall(
  async (data: ApproveClubClaimRequest, context): Promise<{ success: boolean; message: string }> => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated to approve club claims"
      );
    }

    // 2. Verify caller is platform admin
    const callerToken = context.auth.token;
    if (!callerToken.isPlatformAdmin) {
      functions.logger.warn("Non-admin attempted to approve club claim", {
        callerId: context.auth.uid,
        clubId: data.clubId,
      });
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only platform admins can approve club claims"
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

      if (!club.claimedBy) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "Club has no claimant user ID"
        );
      }

      const claimantId = club.claimedBy;
      const now = admin.firestore.Timestamp.now();

      // 5. Get claimant user to get displayName and photoURL
      const userDoc = await db.collection("users").doc(claimantId).get();
      const userData = userDoc.data();
      const displayName = userData?.displayName || userData?.email || "Club Member";
      const photoURL = userData?.photoURL || null;

      // 6. Use transaction for atomic updates
      await db.runTransaction(async (transaction) => {
        // 6a. Update club status to 'claimed'
        transaction.update(clubRef, {
          status: "claimed",
          claimedAt: now,
          updatedAt: now,
        });

        // 6b. Create member document
        const memberRef = db.collection("clubs").doc(data.clubId).collection("members").doc(claimantId);
        transaction.set(memberRef, {
          userId: claimantId,
          displayName: displayName,
          photoURL: photoURL,
          role: "chair", // First member defaults to chair
          joinedAt: now,
          updatedAt: now,
        });

        // 6c. Update user's clubMemberships array
        const userRef = db.collection("users").doc(claimantId);
        transaction.update(userRef, {
          clubMemberships: admin.firestore.FieldValue.arrayUnion(data.clubId),
          updatedAt: now,
        });
      });

      functions.logger.info("Club claim approved", {
        clubId: data.clubId,
        claimantId,
        adminId,
        clubName: club.name,
      });

      // 7. Write audit log
      await writeAuditLog({
        action: "club.claim.approved",
        actorId: adminId,
        actorType: "admin",
        targetType: "club",
        targetId: data.clubId,
        targetClubId: data.clubId,
        details: {
          clubName: club.name,
          claimantId,
          previousStatus: "claim_pending",
          newStatus: "claimed",
        },
        ipAddress: context.rawRequest?.ip || null,
      });

      return {
        success: true,
        message: `Club "${club.name}" claim approved. ${displayName} is now a member.`,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      functions.logger.error("Failed to approve club claim", { error, clubId: data.clubId });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to approve club claim"
      );
    }
  }
);
