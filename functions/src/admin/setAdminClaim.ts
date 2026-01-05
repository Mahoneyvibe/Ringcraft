import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

/**
 * Story 1.2: Platform Admin Role
 *
 * Callable function to grant or revoke platform admin status.
 * Only callable by existing platform admins.
 *
 * Bootstrap Note: The first admin must be created via bootstrap-admin.ts script
 * since there's no admin to call this function initially.
 */

interface SetAdminClaimRequest {
  targetUid: string;
  isAdmin: boolean;
}

interface AuditLogEntry {
  logId: string;
  action: string;
  actorId: string;
  actorType: "admin" | "system";
  targetType: string;
  targetId: string;
  targetClubId: string | null;
  details: Record<string, unknown>;
  timestamp: admin.firestore.Timestamp;
  ipAddress: string | null;
}

/**
 * Write an audit log entry for admin actions.
 * Audit logs are immutable and append-only per Architecture doc §4.7.
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
 * Callable function to set isPlatformAdmin custom claim.
 *
 * Security: Only existing platform admins can call this function.
 * This is verified by checking the caller's auth token for isPlatformAdmin=true.
 */
export const setAdminClaim = functions.https.onCall(
  async (data: SetAdminClaimRequest, context): Promise<{ success: boolean; message: string }> => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated to call this function"
      );
    }

    // 2. Verify caller is a platform admin
    const callerToken = context.auth.token;
    if (!callerToken.isPlatformAdmin) {
      functions.logger.warn("Non-admin attempted to set admin claim", {
        callerId: context.auth.uid,
        targetUid: data.targetUid,
      });
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only platform admins can grant admin privileges"
      );
    }

    // 3. Validate request data
    if (!data.targetUid || typeof data.targetUid !== "string") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "targetUid is required and must be a string"
      );
    }

    if (typeof data.isAdmin !== "boolean") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "isAdmin is required and must be a boolean"
      );
    }

    // 4. Verify target user exists
    try {
      await admin.auth().getUser(data.targetUid);
    } catch (error) {
      throw new functions.https.HttpsError(
        "not-found",
        `User with uid ${data.targetUid} not found`
      );
    }

    // 5. Set the custom claim
    try {
      await admin.auth().setCustomUserClaims(data.targetUid, {
        isPlatformAdmin: data.isAdmin,
      });

      const action = data.isAdmin ? "admin.claim.granted" : "admin.claim.revoked";

      functions.logger.info(`Admin claim ${data.isAdmin ? "granted" : "revoked"}`, {
        actorId: context.auth.uid,
        targetUid: data.targetUid,
      });

      // 6. Write audit log (Task 5)
      await writeAuditLog({
        action,
        actorId: context.auth.uid,
        actorType: "admin",
        targetType: "user",
        targetId: data.targetUid,
        targetClubId: null,
        details: {
          claim: "isPlatformAdmin",
          value: data.isAdmin,
        },
        ipAddress: context.rawRequest?.ip || null,
      });

      return {
        success: true,
        message: `Admin claim ${data.isAdmin ? "granted to" : "revoked from"} user ${data.targetUid}`,
      };
    } catch (error) {
      functions.logger.error("Failed to set admin claim", { error, targetUid: data.targetUid });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to set admin claim"
      );
    }
  }
);
