import * as admin from "firebase-admin";

/**
 * Story 1.2 Bootstrap Script: First Platform Admin
 *
 * Creates the first platform admin by setting the isPlatformAdmin custom claim.
 * This is needed because the setAdminClaim callable function requires an existing
 * admin to call it (chicken-and-egg problem).
 *
 * SAFETY GUARDS:
 * 1. When FIRESTORE_EMULATOR_HOST is set, runs against emulator (safe)
 * 2. When running against production, requires --confirm flag
 *
 * USAGE:
 *   # Emulator (safe - auto-allowed):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node scripts/bootstrap-admin.ts <uid>
 *
 *   # Production (requires confirmation):
 *   npx ts-node scripts/bootstrap-admin.ts <uid> --confirm
 *
 * EXAMPLES:
 *   # Bootstrap test-admin in emulator:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node scripts/bootstrap-admin.ts test-admin
 *
 *   # Bootstrap real admin in production (DANGEROUS):
 *   npx ts-node scripts/bootstrap-admin.ts abc123xyz --confirm
 *
 * AFTER RUNNING:
 * - User must sign out and sign back in to get the new token with the claim
 * - Or wait up to 1 hour for automatic token refresh
 */

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

async function bootstrapAdmin() {
  const args = process.argv.slice(2);
  const targetUid = args.find(arg => !arg.startsWith("--"));
  const hasConfirmFlag = args.includes("--confirm");
  const isEmulator = !!process.env.FIRESTORE_EMULATOR_HOST;

  // 1. Validate arguments
  if (!targetUid) {
    console.error("ERROR: No UID provided.");
    console.error("");
    console.error("Usage:");
    console.error("  FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node scripts/bootstrap-admin.ts <uid>");
    console.error("");
    console.error("Example:");
    console.error("  FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node scripts/bootstrap-admin.ts test-admin");
    process.exit(1);
  }

  // 2. Safety guard for production
  if (!isEmulator && !hasConfirmFlag) {
    console.error("CRITICAL ERROR: Running against PRODUCTION without confirmation.");
    console.error("");
    console.error("If you really want to bootstrap an admin in production, add --confirm:");
    console.error(`  npx ts-node scripts/bootstrap-admin.ts ${targetUid} --confirm`);
    console.error("");
    console.error("For local development, use the emulator:");
    console.error(`  FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node scripts/bootstrap-admin.ts ${targetUid}`);
    process.exit(1);
  }

  // 3. Log environment
  if (isEmulator) {
    console.log(`Running against EMULATOR at ${process.env.FIRESTORE_EMULATOR_HOST}`);
  } else {
    console.log("WARNING: Running against PRODUCTION");
  }

  // 4. Initialize Admin SDK
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: "firstbell-dev",
    });
  }

  console.log(`Bootstrapping admin for UID: ${targetUid}`);

  try {
    // 5. Verify user exists (only works with Auth emulator or real Auth)
    // Note: In emulator, this may fail if Auth emulator isn't running
    // The setCustomUserClaims will still work
    try {
      const userRecord = await admin.auth().getUser(targetUid);
      console.log(`  Found user: ${userRecord.email || userRecord.uid}`);
    } catch (error) {
      console.log("  Note: Could not verify user exists (Auth emulator may not be running)");
      console.log("  Proceeding with claim assignment...");
    }

    // 6. Set the custom claim
    await admin.auth().setCustomUserClaims(targetUid, {
      isPlatformAdmin: true,
    });
    console.log("  Set isPlatformAdmin=true custom claim");

    // 7. Write audit log
    const db = admin.firestore();
    const logRef = db.collection("admin").doc("auditLogs").collection("entries").doc();

    const auditEntry: AuditLogEntry = {
      logId: logRef.id,
      action: "admin.claim.bootstrapped",
      actorId: "SYSTEM_BOOTSTRAP",
      actorType: "system",
      targetType: "user",
      targetId: targetUid,
      targetClubId: null,
      details: {
        claim: "isPlatformAdmin",
        value: true,
        bootstrapScript: true,
      },
      timestamp: admin.firestore.Timestamp.now(),
      ipAddress: null,
    };

    await logRef.set(auditEntry);
    console.log(`  Wrote audit log entry: ${logRef.id}`);

    console.log("");
    console.log("SUCCESS: Admin bootstrapped.");
    console.log("");
    console.log("Next steps:");
    console.log("1. User must sign out and sign back in to receive the new token");
    console.log("2. Or wait up to 1 hour for automatic token refresh");
    console.log("3. Verify by checking the user's ID token claims");
    console.log("");

    if (isEmulator) {
      console.log("Emulator verification:");
      console.log("1. Open Firebase Emulator UI: http://localhost:4000");
      console.log("2. Check Authentication > Users > Custom Claims");
      console.log("3. Check Firestore > admin > auditLogs > entries");
    }

    process.exit(0);
  } catch (error) {
    console.error("FAILED to bootstrap admin:", error);
    process.exit(1);
  }
}

bootstrapAdmin();
