/**
 * Unit Tests for rejectClubClaim Cloud Function
 *
 * Story 2.2: Claim a Club - Reject
 *
 * These tests use mocks to run offline without the Firebase emulator.
 */

// Mock Timestamp
const mockTimestamp = { seconds: 1234567890, nanoseconds: 0 };

// Mock club data
const mockClaimPendingClub = {
  clubId: "repton-abc",
  name: "Repton Amateur Boxing Club",
  region: "London",
  status: "claim_pending",
  claimedBy: "claimant-user-123",
  claimedAt: null,
};

const mockUnclaimedClub = {
  clubId: "dale-youth-abc",
  name: "Dale Youth Amateur Boxing Club",
  region: "London",
  status: "unclaimed",
  claimedBy: null,
  claimedAt: null,
};

const mockClaimedClub = {
  clubId: "sheffield-city-abc",
  name: "Sheffield City Amateur Boxing Club",
  region: "Yorkshire",
  status: "claimed",
  claimedBy: "other-user",
  claimedAt: mockTimestamp,
};

// Mock Firestore operations
const mockClubGet = jest.fn();
const mockClubUpdate = jest.fn().mockResolvedValue(undefined);
const mockAuditLogSet = jest.fn().mockResolvedValue(undefined);
const mockAuditLogDoc = jest.fn().mockReturnValue({
  id: "mock-audit-log-id",
  set: mockAuditLogSet,
});

const mockAuditLogsCollection = jest.fn().mockReturnValue({
  doc: mockAuditLogDoc,
});

// Mock firebase-admin before importing the function
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => ({
      collection: jest.fn((collectionName: string) => {
        if (collectionName === "clubs") {
          return {
            doc: jest.fn().mockReturnValue({
              get: mockClubGet,
              update: mockClubUpdate,
            }),
          };
        }
        if (collectionName === "admin") {
          return {
            doc: jest.fn().mockReturnValue({
              collection: mockAuditLogsCollection,
            }),
          };
        }
        return { doc: jest.fn() };
      }),
    })),
    {
      Timestamp: { now: jest.fn(() => mockTimestamp) },
    }
  ),
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
import { rejectClubClaim } from "../../clubs/rejectClubClaim";

// Type assertion for the mocked callable function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callRejectClubClaim = rejectClubClaim as any;

describe("rejectClubClaim", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication and Authorization (AC: 2, Task 7.1)", () => {
    it("should reject unauthenticated calls", async () => {
      const context = { auth: null };

      await expect(
        callRejectClubClaim({ clubId: "repton-abc" }, context)
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
        callRejectClubClaim({ clubId: "repton-abc" }, context)
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
        callRejectClubClaim({ clubId: "repton-abc" }, context)
      ).rejects.toMatchObject({
        code: "permission-denied",
      });
    });
  });

  describe("Reject resets club to unclaimed (AC: 2, Task 7.2)", () => {
    it("should reset club status to unclaimed", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      const result = await callRejectClubClaim({ clubId: "repton-abc" }, context);

      expect(result.success).toBe(true);
      expect(mockClubUpdate).toHaveBeenCalledWith({
        status: "unclaimed",
        claimedBy: null,
        updatedAt: mockTimestamp,
      });
    });

    it("should clear claimedBy field", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      await callRejectClubClaim({ clubId: "repton-abc" }, context);

      expect(mockClubUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          claimedBy: null,
        })
      );
    });

    it("should return success message indicating club is available again", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      const result = await callRejectClubClaim({ clubId: "repton-abc" }, context);

      expect(result.message).toContain("Repton Amateur Boxing Club");
      expect(result.message).toContain("rejected");
      expect(result.message).toContain("available for claiming");
    });
  });

  describe("Reject on non-pending club fails (AC: 2, Task 7.3)", () => {
    it("should reject rejection of unclaimed club", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockUnclaimedClub,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
      };

      await expect(
        callRejectClubClaim({ clubId: "dale-youth-abc" }, context)
      ).rejects.toMatchObject({
        code: "failed-precondition",
        message: expect.stringContaining("not pending approval"),
      });
    });

    it("should reject rejection of already claimed club", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimedClub,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
      };

      await expect(
        callRejectClubClaim({ clubId: "sheffield-city-abc" }, context)
      ).rejects.toMatchObject({
        code: "failed-precondition",
      });
    });
  });

  describe("Audit logging (AC: 4, Task 7.4)", () => {
    it("should write audit log entry on successful rejection", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });

      const context = {
        auth: {
          uid: "admin-actor",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "192.168.1.1" },
      };

      await callRejectClubClaim({ clubId: "repton-abc" }, context);

      expect(mockAuditLogSet).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "club.claim.rejected",
          actorId: "admin-actor",
          actorType: "admin",
          targetType: "club",
          targetId: "repton-abc",
          targetClubId: "repton-abc",
          details: expect.objectContaining({
            clubName: "Repton Amateur Boxing Club",
            claimantId: "claimant-user-123",
            previousStatus: "claim_pending",
            newStatus: "unclaimed",
          }),
        })
      );
    });

    it("should include rejection reason in audit log when provided", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "10.0.0.1" },
      };

      await callRejectClubClaim(
        { clubId: "repton-abc", reason: "Invalid documentation provided" },
        context
      );

      expect(mockAuditLogSet).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            reason: "Invalid documentation provided",
          }),
        })
      );
    });

    it("should handle missing reason gracefully", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "10.0.0.1" },
      };

      await callRejectClubClaim({ clubId: "repton-abc" }, context);

      expect(mockAuditLogSet).toHaveBeenCalledWith(
        expect.objectContaining({
          details: expect.objectContaining({
            reason: null,
          }),
        })
      );
    });

    it("should include IP address in audit log", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "10.0.0.1" },
      };

      await callRejectClubClaim({ clubId: "repton-abc" }, context);

      expect(mockAuditLogSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "10.0.0.1",
        })
      );
    });
  });

  describe("Input validation", () => {
    const adminContext = {
      auth: {
        uid: "admin-user",
        token: { isPlatformAdmin: true },
      },
    };

    it("should reject missing clubId", async () => {
      await expect(
        callRejectClubClaim({}, adminContext)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject empty clubId", async () => {
      await expect(
        callRejectClubClaim({ clubId: "" }, adminContext)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject non-existent club", async () => {
      mockClubGet.mockResolvedValue({
        exists: false,
      });

      await expect(
        callRejectClubClaim({ clubId: "nonexistent-club" }, adminContext)
      ).rejects.toMatchObject({
        code: "not-found",
      });
    });
  });
});
