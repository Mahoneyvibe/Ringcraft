/**
 * Unit Tests for setAdminClaim Cloud Function
 *
 * Story 1.2: Platform Admin Role
 *
 * These tests use mocks to run offline without the Firebase emulator.
 */

// Mock Timestamp
const mockTimestamp = { seconds: 1234567890, nanoseconds: 0 };

// Mock Firestore
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockDoc = jest.fn().mockReturnValue({
  id: "mock-log-id",
  set: mockSet,
});
const mockCollection = jest.fn().mockReturnValue({
  doc: mockDoc,
});

// Mock Auth
const mockSetCustomUserClaims = jest.fn().mockResolvedValue(undefined);
const mockGetUser = jest.fn().mockResolvedValue({
  uid: "target-user",
  email: "target@example.com",
});

// Mock firebase-admin before importing the function
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => ({
      collection: jest.fn().mockReturnValue({
        doc: jest.fn().mockReturnValue({
          collection: mockCollection,
        }),
      }),
    })),
    {
      Timestamp: { now: jest.fn(() => mockTimestamp) },
    }
  ),
  auth: jest.fn(() => ({
    setCustomUserClaims: mockSetCustomUserClaims,
    getUser: mockGetUser,
  })),
}));

// Mock firebase-functions
jest.mock("firebase-functions", () => ({
  https: {
    onCall: jest.fn((handler) => handler),
    HttpsError: class HttpsError extends Error {
      constructor(public code: string, public message: string) {
        super(message);
        this.name = "HttpsError";
      }
    },
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocking
import { setAdminClaim } from "../../admin/setAdminClaim";

// Type assertion for the mocked callable function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callSetAdminClaim = setAdminClaim as any;

describe("setAdminClaim", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("should reject unauthenticated calls", async () => {
      const context = { auth: null };

      await expect(
        callSetAdminClaim({ targetUid: "some-user", isAdmin: true }, context)
      ).rejects.toMatchObject({
        code: "unauthenticated",
      });
    });

    it("should reject calls from non-admin users", async () => {
      const context = {
        auth: {
          uid: "regular-user",
          token: { isPlatformAdmin: false },
        },
      };

      await expect(
        callSetAdminClaim({ targetUid: "target-user", isAdmin: true }, context)
      ).rejects.toMatchObject({
        code: "permission-denied",
      });
    });

    it("should reject calls from users without isPlatformAdmin claim", async () => {
      const context = {
        auth: {
          uid: "regular-user",
          token: {}, // No isPlatformAdmin claim
        },
      };

      await expect(
        callSetAdminClaim({ targetUid: "target-user", isAdmin: true }, context)
      ).rejects.toMatchObject({
        code: "permission-denied",
      });
    });
  });

  describe("Admin granting admin", () => {
    it("should allow existing admin to grant admin to another user", async () => {
      const context = {
        auth: {
          uid: "existing-admin",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      const result = await callSetAdminClaim(
        { targetUid: "new-admin", isAdmin: true },
        context
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("granted to");
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith("new-admin", {
        isPlatformAdmin: true,
      });
    });

    it("should allow admin to revoke admin from another user", async () => {
      const context = {
        auth: {
          uid: "existing-admin",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      const result = await callSetAdminClaim(
        { targetUid: "former-admin", isAdmin: false },
        context
      );

      expect(result.success).toBe(true);
      expect(result.message).toContain("revoked from");
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith("former-admin", {
        isPlatformAdmin: false,
      });
    });
  });

  describe("Input validation", () => {
    const adminContext = {
      auth: {
        uid: "admin-user",
        token: { isPlatformAdmin: true },
      },
    };

    it("should reject missing targetUid", async () => {
      await expect(
        callSetAdminClaim({ targetUid: "", isAdmin: true }, adminContext)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject non-string targetUid", async () => {
      await expect(
        callSetAdminClaim({ targetUid: 123, isAdmin: true }, adminContext)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject missing isAdmin", async () => {
      await expect(
        callSetAdminClaim({ targetUid: "user-123" }, adminContext)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject non-existent user", async () => {
      mockGetUser.mockRejectedValueOnce(new Error("User not found"));

      await expect(
        callSetAdminClaim({ targetUid: "nonexistent-user", isAdmin: true }, adminContext)
      ).rejects.toMatchObject({
        code: "not-found",
      });
    });
  });

  describe("Audit logging", () => {
    it("should write audit log entry when granting admin", async () => {
      const context = {
        auth: {
          uid: "admin-actor",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "192.168.1.1" },
      };

      await callSetAdminClaim({ targetUid: "new-admin", isAdmin: true }, context);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "admin.claim.granted",
          actorId: "admin-actor",
          actorType: "admin",
          targetType: "user",
          targetId: "new-admin",
          details: expect.objectContaining({
            claim: "isPlatformAdmin",
            value: true,
          }),
        })
      );
    });

    it("should write audit log entry when revoking admin", async () => {
      const context = {
        auth: {
          uid: "admin-actor",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "192.168.1.1" },
      };

      await callSetAdminClaim({ targetUid: "old-admin", isAdmin: false }, context);

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "admin.claim.revoked",
          actorId: "admin-actor",
          targetId: "old-admin",
          details: expect.objectContaining({
            value: false,
          }),
        })
      );
    });
  });

  describe("Independence from clubMemberships (AC: 2)", () => {
    it("should grant admin regardless of user's clubMemberships", async () => {
      // User has club memberships but that shouldn't affect admin grant
      const context = {
        auth: {
          uid: "existing-admin",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      // Simulate a user who has club memberships
      mockGetUser.mockResolvedValueOnce({
        uid: "user-with-clubs",
        email: "clubmember@example.com",
        customClaims: {}, // No admin claim, but user has clubMemberships in Firestore
      });

      const result = await callSetAdminClaim(
        { targetUid: "user-with-clubs", isAdmin: true },
        context
      );

      expect(result.success).toBe(true);
      // The admin claim is set independently - setCustomUserClaims only sets isPlatformAdmin
      expect(mockSetCustomUserClaims).toHaveBeenCalledWith("user-with-clubs", {
        isPlatformAdmin: true,
      });
    });

    it("should not require clubMemberships to grant admin", async () => {
      const context = {
        auth: {
          uid: "existing-admin",
          token: { isPlatformAdmin: true },
        },
        rawRequest: {},
      };

      // User with no club memberships
      mockGetUser.mockResolvedValueOnce({
        uid: "user-no-clubs",
        email: "noclubs@example.com",
        customClaims: {},
      });

      const result = await callSetAdminClaim(
        { targetUid: "user-no-clubs", isAdmin: true },
        context
      );

      expect(result.success).toBe(true);
    });
  });
});
