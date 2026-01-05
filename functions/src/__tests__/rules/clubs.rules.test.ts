/**
 * Security Rules Tests for Clubs Collection
 *
 * Story 2.1 - Pre-Seeded Club Directory
 *
 * REQUIRES: Firebase Emulator running on localhost:8080
 * Run with: npm run test:emulator
 *
 * These tests validate that club security rules work correctly:
 * - Authenticated users can read clubs
 * - Unauthenticated users cannot read clubs
 * - Clients cannot create/update/delete clubs
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

describeIfEmulator("Club Security Rules", () => {
  beforeAll(async () => {
    // Read the security rules
    const rulesPath = path.resolve(__dirname, "../../../../firestore.rules");
    const rules = fs.readFileSync(rulesPath, "utf8");

    testEnv = await initializeTestEnvironment({
      projectId: "firstbell-test-clubs",
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

  describe("Club Read Access (AC: 2)", () => {
    it("should allow authenticated user to read club document", async () => {
      // Setup: Create a club
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("clubs").doc("test-club").set({
          clubId: "test-club",
          name: "Test Boxing Club",
          region: "London",
          status: "unclaimed",
          claimedBy: null,
          claimedAt: null,
          contactEmail: null,
          contactPhone: "+44123456789",
        });
      });

      // Test: Authenticated user can read club
      const authUser = testEnv.authenticatedContext("user-123", {});
      const clubRef = authUser.firestore().collection("clubs").doc("test-club");
      await assertSucceeds(clubRef.get());
    });

    it("should deny unauthenticated user from reading club document", async () => {
      // Setup: Create a club
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("clubs").doc("test-club").set({
          clubId: "test-club",
          name: "Test Boxing Club",
          region: "London",
          status: "unclaimed",
        });
      });

      // Test: Unauthenticated user cannot read club
      const unauthUser = testEnv.unauthenticatedContext();
      const clubRef = unauthUser.firestore().collection("clubs").doc("test-club");
      await assertFails(clubRef.get());
    });

    it("should allow authenticated user to list clubs", async () => {
      // Setup: Create multiple clubs
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("clubs").doc("club-1").set({
          clubId: "club-1",
          name: "Club One",
          region: "London",
          status: "unclaimed",
        });
        await context.firestore().collection("clubs").doc("club-2").set({
          clubId: "club-2",
          name: "Club Two",
          region: "Yorkshire",
          status: "unclaimed",
        });
      });

      // Test: Authenticated user can list clubs
      const authUser = testEnv.authenticatedContext("user-456", {});
      const clubsRef = authUser.firestore().collection("clubs");
      await assertSucceeds(clubsRef.get());
    });

    it("should deny unauthenticated user from listing clubs", async () => {
      // Test: Unauthenticated user cannot list clubs
      const unauthUser = testEnv.unauthenticatedContext();
      const clubsRef = unauthUser.firestore().collection("clubs");
      await assertFails(clubsRef.get());
    });
  });

  describe("Club Create Access (AC: 1)", () => {
    it("should deny client from creating club document", async () => {
      // Test: Authenticated user cannot create club
      const authUser = testEnv.authenticatedContext("user-123", {});
      const clubRef = authUser.firestore().collection("clubs").doc("new-club");
      await assertFails(
        clubRef.set({
          clubId: "new-club",
          name: "New Boxing Club",
          region: "London",
          status: "unclaimed",
        })
      );
    });

    it("should deny admin from creating club document via client", async () => {
      // Test: Even admin cannot create club via client (must use scripts)
      const adminUser = testEnv.authenticatedContext("admin-user", {
        isPlatformAdmin: true,
      });
      const clubRef = adminUser.firestore().collection("clubs").doc("admin-club");
      await assertFails(
        clubRef.set({
          clubId: "admin-club",
          name: "Admin Created Club",
          region: "London",
          status: "unclaimed",
        })
      );
    });

    it("should deny unauthenticated user from creating club", async () => {
      const unauthUser = testEnv.unauthenticatedContext();
      const clubRef = unauthUser.firestore().collection("clubs").doc("unauth-club");
      await assertFails(
        clubRef.set({
          clubId: "unauth-club",
          name: "Unauth Club",
          region: "London",
          status: "unclaimed",
        })
      );
    });
  });

  describe("Club Update Access", () => {
    it("should deny client from updating club document directly", async () => {
      // Setup: Create a club
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("clubs").doc("test-club").set({
          clubId: "test-club",
          name: "Test Boxing Club",
          region: "London",
          status: "unclaimed",
          claimedBy: null,
        });
      });

      // Test: Authenticated user cannot update club
      const authUser = testEnv.authenticatedContext("user-123", {});
      const clubRef = authUser.firestore().collection("clubs").doc("test-club");
      await assertFails(
        clubRef.update({
          status: "claimed",
          claimedBy: "user-123",
        })
      );
    });

    it("should deny admin from updating club via client", async () => {
      // Setup: Create a club
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("clubs").doc("test-club").set({
          clubId: "test-club",
          name: "Test Boxing Club",
          region: "London",
          status: "unclaimed",
        });
      });

      // Test: Admin cannot update club via client (must use Cloud Functions)
      const adminUser = testEnv.authenticatedContext("admin-user", {
        isPlatformAdmin: true,
      });
      const clubRef = adminUser.firestore().collection("clubs").doc("test-club");
      await assertFails(
        clubRef.update({
          status: "suspended",
        })
      );
    });
  });

  describe("Club Delete Access", () => {
    it("should deny deletion of club documents", async () => {
      // Setup: Create a club
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("clubs").doc("test-club").set({
          clubId: "test-club",
          name: "Test Boxing Club",
          region: "London",
          status: "unclaimed",
        });
      });

      // Test: Authenticated user cannot delete club
      const authUser = testEnv.authenticatedContext("user-123", {});
      const clubRef = authUser.firestore().collection("clubs").doc("test-club");
      await assertFails(clubRef.delete());
    });

    it("should deny admin from deleting club documents", async () => {
      // Setup: Create a club
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("clubs").doc("test-club").set({
          clubId: "test-club",
          name: "Test Boxing Club",
          region: "London",
          status: "unclaimed",
        });
      });

      // Test: Admin cannot delete club (invariant: clubs never deleted)
      const adminUser = testEnv.authenticatedContext("admin-user", {
        isPlatformAdmin: true,
      });
      const clubRef = adminUser.firestore().collection("clubs").doc("test-club");
      await assertFails(clubRef.delete());
    });
  });

  describe("Query by Region", () => {
    it("should allow authenticated user to query clubs by region", async () => {
      // Setup: Create clubs in different regions
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection("clubs").doc("london-club").set({
          clubId: "london-club",
          name: "London Club",
          region: "London",
          status: "unclaimed",
        });
        await context.firestore().collection("clubs").doc("yorkshire-club").set({
          clubId: "yorkshire-club",
          name: "Yorkshire Club",
          region: "Yorkshire",
          status: "unclaimed",
        });
      });

      // Test: Query by region succeeds
      const authUser = testEnv.authenticatedContext("user-123", {});
      const query = authUser
        .firestore()
        .collection("clubs")
        .where("region", "==", "London");
      await assertSucceeds(query.get());
    });
  });
});
