import * as admin from "firebase-admin";

/**
 * Phase 0 Seed Script: admin/settings
 * Ensures the infrastructure kill switch exists in the emulator.
 */

async function seed() {
  // 1. Guard: Hard-fail if not running against the emulator
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error("CRITICAL ERROR: FIRESTORE_EMULATOR_HOST is not set.");
    console.error("This script MUST only run against the Firestore Emulator.");
    process.exit(1);
  }

  console.log(`Connecting to Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);

  // 2. Initialize Admin SDK
  // In emulator mode, project ID can be anything, but we use a placeholder
  // if not provided by the environment.
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: "firstbell-dev",
    });
  }

  const db = admin.firestore();

  // 3. Seed admin/settings
  const settingsRef = db.doc("admin/settings");
  
  const seedData = {
    proposalKillSwitch: true,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  try {
    await settingsRef.set(seedData);
    console.log("SUCCESS: admin/settings document created with proposalKillSwitch: true");
    process.exit(0);
  } catch (error) {
    console.error("FAILED to seed admin/settings:", error);
    process.exit(1);
  }
}

seed();
