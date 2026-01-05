/**
 * Security Rules Tests for Users Collection
 *
 * Story 1.1 - User Authentication
 *
 * REQUIRES: Firebase Emulator running on localhost:8080
 * Run with: npm run test:emulator
 *
 * These tests validate the Firestore security rules for the users collection.
 */

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import * as fs from "fs";
import * as path from "path";

let testEnv: RulesTestEnvironment;

// Skip these tests if emulator is not running
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST;
const describeIfEmulator = EMULATOR_HOST ? describe : describe.skip;

describeIfEmulator("Users Collection Security Rules", () => {
  beforeAll(async () => {
    // Read the security rules
    const rulesPath = path.resolve(__dirname, "../../../../firestore.rules");
    const rules = fs.readFileSync(rulesPath, "utf8");

    testEnv = await initializeTestEnvironment({
      projectId: "firstbell-test",
      firestore: {
        rules,
        host: "localhost",
        port: 8080,
      },
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  describe("Read Access", () => {
    it("should allow authenticated user to read any user doc", async () => {
      // Setup: Create a user doc
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc("other-user").set({
          uid: "other-user",
          email: "other@example.com",
          displayName: "Other User",
          clubMemberships: [],
        });
      });

      // Test: Authenticated user can read
      const authedUser = testEnv.authenticatedContext("test-user");
      const docRef = authedUser.firestore().collection("users").doc("other-user");
      await assertSucceeds(docRef.get());
    });

    it("should deny unauthenticated user from reading user docs", async () => {
      // Setup: Create a user doc
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc("some-user").set({
          uid: "some-user",
          email: "some@example.com",
        });
      });

      // Test: Unauthenticated user cannot read
      const unauthed = testEnv.unauthenticatedContext();
      const docRef = unauthed.firestore().collection("users").doc("some-user");
      await assertFails(docRef.get());
    });
  });

  describe("Create Access", () => {
    it("should allow user to create their own doc (uid match)", async () => {
      const userId = "new-user-123";
      const authedUser = testEnv.authenticatedContext(userId);
      const docRef = authedUser.firestore().collection("users").doc(userId);

      await assertSucceeds(
        docRef.set({
          uid: userId,
          email: "new@example.com",
          displayName: "New User",
          clubMemberships: [],
        })
      );
    });

    it("should deny user from creating doc for another user", async () => {
      const authedUser = testEnv.authenticatedContext("user-a");
      const docRef = authedUser.firestore().collection("users").doc("user-b");

      await assertFails(
        docRef.set({
          uid: "user-b",
          email: "b@example.com",
        })
      );
    });
  });

  describe("Update Access", () => {
    it("should allow user to update their own doc", async () => {
      const userId = "update-user";

      // Setup: Create user doc
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc(userId).set({
          uid: userId,
          email: "update@example.com",
          displayName: "Original Name",
          clubMemberships: [],
        });
      });

      // Test: User can update own doc
      const authedUser = testEnv.authenticatedContext(userId);
      const docRef = authedUser.firestore().collection("users").doc(userId);
      await assertSucceeds(docRef.update({ displayName: "New Name" }));
    });

    it("should deny user from updating another user's doc", async () => {
      // Setup: Create target user doc
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc("target-user").set({
          uid: "target-user",
          email: "target@example.com",
        });
      });

      // Test: Different user cannot update
      const authedUser = testEnv.authenticatedContext("attacker-user");
      const docRef = authedUser.firestore().collection("users").doc("target-user");
      await assertFails(docRef.update({ displayName: "Hacked!" }));
    });

    it("should allow platform admin to update any user doc", async () => {
      // Setup: Create target user doc
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc("target-user").set({
          uid: "target-user",
          email: "target@example.com",
        });
      });

      // Test: Admin can update any user
      const adminUser = testEnv.authenticatedContext("admin-user", {
        isPlatformAdmin: true,
      });
      const docRef = adminUser.firestore().collection("users").doc("target-user");
      await assertSucceeds(docRef.update({ displayName: "Admin Updated" }));
    });
  });

  describe("Delete Access", () => {
    it("should deny any user from deleting user docs", async () => {
      const userId = "delete-target";

      // Setup: Create user doc
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc(userId).set({
          uid: userId,
          email: "delete@example.com",
        });
      });

      // Test: Even owner cannot delete
      const authedUser = testEnv.authenticatedContext(userId);
      const docRef = authedUser.firestore().collection("users").doc(userId);
      await assertFails(docRef.delete());
    });

    it("should deny even admin from deleting user docs", async () => {
      // Setup: Create user doc
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc("protected-user").set({
          uid: "protected-user",
          email: "protected@example.com",
        });
      });

      // Test: Admin cannot delete
      const adminUser = testEnv.authenticatedContext("admin-user", {
        isPlatformAdmin: true,
      });
      const docRef = adminUser.firestore().collection("users").doc("protected-user");
      await assertFails(docRef.delete());
    });
  });
});
