import * as admin from "firebase-admin";

/**
 * Story 1.1 Seed Script: Test Users
 *
 * Creates test user documents in the Firestore emulator for manual testing.
 *
 * REQUIRES: Firestore Emulator running
 * RUN: FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node scripts/seed-test-users.ts
 *
 * Test Users Created:
 * 1. test-user-1 - Basic user with no club memberships
 * 2. test-user-2 - User with example club membership
 * 3. test-admin - Platform admin user (has isPlatformAdmin claim when used with Auth emulator)
 */

async function seedTestUsers() {
  // 1. Guard: Hard-fail if not running against the emulator
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    console.error("CRITICAL ERROR: FIRESTORE_EMULATOR_HOST is not set.");
    console.error("This script MUST only run against the Firestore Emulator.");
    console.error("");
    console.error("Usage:");
    console.error("  FIRESTORE_EMULATOR_HOST=localhost:8080 npx ts-node scripts/seed-test-users.ts");
    process.exit(1);
  }

  console.log(`Connecting to Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);

  // 2. Initialize Admin SDK
  if (!admin.apps.length) {
    admin.initializeApp({
      projectId: "firstbell-dev",
    });
  }

  const db = admin.firestore();

  // 3. Define test users
  const testUsers = [
    {
      uid: "test-user-1",
      email: "testuser1@example.com",
      displayName: "Test User One",
      photoURL: null,
      clubMemberships: [], // No club access
    },
    {
      uid: "test-user-2",
      email: "testuser2@example.com",
      displayName: "Test User Two",
      photoURL: "https://example.com/avatar.jpg",
      clubMemberships: ["club-example-123"], // Has club membership
    },
    {
      uid: "test-admin",
      email: "admin@firstbell.com",
      displayName: "Platform Admin",
      photoURL: null,
      clubMemberships: [], // Admin doesn't need club membership
      // Note: isPlatformAdmin is set via Auth custom claims, not Firestore
    },
  ];

  // 4. Seed users
  console.log("Seeding test users...");

  try {
    for (const user of testUsers) {
      const userRef = db.collection("users").doc(user.uid);
      await userRef.set({
        ...user,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`  ✓ Created user: ${user.uid} (${user.email})`);
    }

    console.log("");
    console.log("SUCCESS: All test users created.");
    console.log("");
    console.log("Manual Testing Steps:");
    console.log("1. Start Firebase Emulators: firebase emulators:start");
    console.log("2. Open Emulator UI: http://localhost:4000");
    console.log("3. Navigate to Firestore > users collection");
    console.log("4. Verify test users exist with correct schema");
    console.log("");
    console.log("To test Auth trigger:");
    console.log("1. Create a new user in Auth Emulator UI");
    console.log("2. Verify user doc is automatically created in Firestore");
    process.exit(0);
  } catch (error) {
    console.error("FAILED to seed test users:", error);
    process.exit(1);
  }
}

seedTestUsers();
