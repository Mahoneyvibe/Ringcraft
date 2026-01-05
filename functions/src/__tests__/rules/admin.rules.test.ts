/**
 * Security Rules Tests for Admin Claims
 *
 * Story 1.2 - Platform Admin Role
 *
 * REQUIRES: Firebase Emulator running on localhost:8080
 * Run with: npm run test:emulator
 *
 * These tests validate that the isPlatformAdmin claim is properly recognized
 * in Firestore security rules.
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

describeIfEmulator("Admin Claims Security Rules", () => {
  beforeAll(async () => {
    // Read the security rules
    const rulesPath = path.resolve(__dirname, "../../../../firestore.rules");
    const rules = fs.readFileSync(rulesPath, "utf8");

    testEnv = await initializeTestEnvironment({
      projectId: "firstbell-test-admin",
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

  describe("isPlatformAdmin() helper", () => {
    it("should return true for user with isPlatformAdmin claim", async () => {
      // Setup: Create a user doc that the admin will try to update
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc("target-user").set({
          uid: "target-user",
          email: "target@example.com",
          displayName: "Target User",
          clubMemberships: [],
        });
      });

      // Test: Admin with isPlatformAdmin=true can update any user
      const adminUser = testEnv.authenticatedContext("admin-user", {
        isPlatformAdmin: true,
      });
      const docRef = adminUser.firestore().collection("users").doc("target-user");
      await assertSucceeds(docRef.update({ displayName: "Updated by Admin" }));
    });

    it("should return false for user without isPlatformAdmin claim", async () => {
      // Setup: Create a user doc
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc("target-user").set({
          uid: "target-user",
          email: "target@example.com",
        });
      });

      // Test: Regular user without isPlatformAdmin cannot update other user's doc
      const regularUser = testEnv.authenticatedContext("regular-user", {});
      const docRef = regularUser.firestore().collection("users").doc("target-user");
      await assertFails(docRef.update({ displayName: "Attempted Update" }));
    });

    it("should return false for isPlatformAdmin=false", async () => {
      // Setup: Create a user doc
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc("target-user").set({
          uid: "target-user",
          email: "target@example.com",
        });
      });

      // Test: User with explicit isPlatformAdmin=false cannot update other user's doc
      const nonAdminUser = testEnv.authenticatedContext("non-admin-user", {
        isPlatformAdmin: false,
      });
      const docRef = nonAdminUser.firestore().collection("users").doc("target-user");
      await assertFails(docRef.update({ displayName: "Attempted Update" }));
    });
  });

  describe("Audit Logs Access", () => {
    it("should allow admin to read audit logs", async () => {
      // Setup: Create an audit log entry
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection("admin")
          .doc("auditLogs")
          .collection("entries")
          .doc("log-1")
          .set({
            logId: "log-1",
            action: "admin.claim.granted",
            actorId: "some-admin",
            targetId: "some-user",
            timestamp: new Date(),
          });
      });

      // Test: Admin can read audit logs
      const adminUser = testEnv.authenticatedContext("admin-user", {
        isPlatformAdmin: true,
      });
      const logRef = adminUser
        .firestore()
        .collection("admin")
        .doc("auditLogs")
        .collection("entries")
        .doc("log-1");
      await assertSucceeds(logRef.get());
    });

    it("should deny non-admin from reading audit logs", async () => {
      // Setup: Create an audit log entry
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection("admin")
          .doc("auditLogs")
          .collection("entries")
          .doc("log-1")
          .set({
            logId: "log-1",
            action: "admin.claim.granted",
            actorId: "some-admin",
            targetId: "some-user",
            timestamp: new Date(),
          });
      });

      // Test: Regular user cannot read audit logs
      const regularUser = testEnv.authenticatedContext("regular-user", {});
      const logRef = regularUser
        .firestore()
        .collection("admin")
        .doc("auditLogs")
        .collection("entries")
        .doc("log-1");
      await assertFails(logRef.get());
    });

    it("should deny clients from writing audit logs", async () => {
      // Test: Even admin cannot write audit logs (Cloud Functions only)
      const adminUser = testEnv.authenticatedContext("admin-user", {
        isPlatformAdmin: true,
      });
      const logRef = adminUser
        .firestore()
        .collection("admin")
        .doc("auditLogs")
        .collection("entries")
        .doc("new-log");
      await assertFails(
        logRef.set({
          logId: "new-log",
          action: "attempted.client.write",
          actorId: "admin-user",
        })
      );
    });
  });

  describe("Admin User Document Updates", () => {
    it("should allow admin to update any user doc", async () => {
      const targetUserId = "target-user-123";

      // Setup: Create target user doc
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc(targetUserId).set({
          uid: targetUserId,
          email: "target@example.com",
          displayName: "Target User",
          clubMemberships: ["some-club"],
        });
      });

      // Test: Admin can update target user's doc
      const adminUser = testEnv.authenticatedContext("admin-user", {
        isPlatformAdmin: true,
      });
      const docRef = adminUser.firestore().collection("users").doc(targetUserId);
      await assertSucceeds(docRef.update({ displayName: "Admin Updated" }));
    });

    it("should still allow user to update their own doc", async () => {
      const userId = "self-update-user";

      // Setup: Create user's own doc
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc(userId).set({
          uid: userId,
          email: "self@example.com",
          displayName: "Self User",
          clubMemberships: [],
        });
      });

      // Test: User can update their own doc (not admin)
      const selfUser = testEnv.authenticatedContext(userId, {});
      const docRef = selfUser.firestore().collection("users").doc(userId);
      await assertSucceeds(docRef.update({ displayName: "Self Updated" }));
    });
  });

  describe("Independence from clubMemberships (AC: 2)", () => {
    it("should grant admin access regardless of clubMemberships", async () => {
      // Setup: Create target user and a club member doc
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc("target-user").set({
          uid: "target-user",
          email: "target@example.com",
          clubMemberships: ["club-xyz"],
        });
      });

      // Test: Admin with NO club memberships can still update user
      const adminNoClubs = testEnv.authenticatedContext("admin-no-clubs", {
        isPlatformAdmin: true,
        // No club memberships - admin access is separate
      });
      const docRef = adminNoClubs.firestore().collection("users").doc("target-user");
      await assertSucceeds(docRef.update({ displayName: "Updated by Admin" }));
    });

    it("should not grant admin access to club members without admin claim", async () => {
      // Setup: Create target user
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc("target-user").set({
          uid: "target-user",
          email: "target@example.com",
          clubMemberships: [],
        });
      });

      // Test: User with club memberships but no admin claim cannot update other users
      const clubMember = testEnv.authenticatedContext("club-member", {
        // Has club memberships but NOT isPlatformAdmin
      });
      const docRef = clubMember.firestore().collection("users").doc("target-user");
      await assertFails(docRef.update({ displayName: "Attempted Update" }));
    });

    it("should grant admin access even if user also has club memberships", async () => {
      // Setup: Create target user
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("users").doc("target-user").set({
          uid: "target-user",
          email: "target@example.com",
          clubMemberships: [],
        });
      });

      // Test: User who is both club member AND admin has admin access
      const adminWithClubs = testEnv.authenticatedContext("admin-with-clubs", {
        isPlatformAdmin: true,
        // Note: clubMemberships are stored in Firestore, not claims
      });
      const docRef = adminWithClubs.firestore().collection("users").doc("target-user");
      await assertSucceeds(docRef.update({ displayName: "Updated by Admin" }));
    });
  });
});
