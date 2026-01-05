/**
 * Unit Tests for approveClubClaim Cloud Function
 *
 * Story 2.2: Claim a Club - Approve
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

const mockClaimantUser = {
  displayName: "John Claimant",
  email: "john@example.com",
};

// Mock Firestore operations
const mockClubGet = jest.fn();
const mockUserGet = jest.fn();
const mockTransactionUpdate = jest.fn();
const mockTransactionSet = jest.fn();
const mockRunTransaction = jest.fn();
const mockAuditLogSet = jest.fn().mockResolvedValue(undefined);
const mockAuditLogDoc = jest.fn().mockReturnValue({
  id: "mock-audit-log-id",
  set: mockAuditLogSet,
});

const mockUserDoc = jest.fn().mockReturnValue({
  get: mockUserGet,
  update: jest.fn(),
});

const mockMemberDoc = jest.fn().mockReturnValue({
  set: jest.fn(),
});

const mockMembersCollection = jest.fn().mockReturnValue({
  doc: mockMemberDoc,
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
            doc: jest.fn((_docId: string) => ({
              get: mockClubGet,
              update: jest.fn(),
              collection: mockMembersCollection,
            })),
          };
        }
        if (collectionName === "users") {
          return { doc: mockUserDoc };
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
      runTransaction: mockRunTransaction,
    })),
    {
      Timestamp: { now: jest.fn(() => mockTimestamp) },
      FieldValue: {
        arrayUnion: jest.fn((val) => ({ __arrayUnion: val })),
      },
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
import { approveClubClaim } from "../../clubs/approveClubClaim";

// Type assertion for the mocked callable function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callApproveClubClaim = approveClubClaim as any;

describe("approveClubClaim", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: run transaction executes the callback
    mockRunTransaction.mockImplementation(async (callback: (t: unknown) => Promise<void>) => {
      const mockTransaction = {
        update: mockTransactionUpdate,
        set: mockTransactionSet,
      };
      return callback(mockTransaction);
    });
  });

  describe("Authentication and Authorization (AC: 2, Task 6.1)", () => {
    it("should reject unauthenticated calls", async () => {
      const context = { auth: null };

      await expect(
        callApproveClubClaim({ clubId: "repton-abc" }, context)
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
        callApproveClubClaim({ clubId: "repton-abc" }, context)
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
        callApproveClubClaim({ clubId: "repton-abc" }, context)
      ).rejects.toMatchObject({
        code: "permission-denied",
      });
    });
  });

  describe("Approve sets status to claimed (AC: 3, Task 6.2)", () => {
    it("should update club status to claimed", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });
      mockUserGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimantUser,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      const result = await callApproveClubClaim({ clubId: "repton-abc" }, context);

      expect(result.success).toBe(true);
      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: "claimed",
          claimedAt: mockTimestamp,
          updatedAt: mockTimestamp,
        })
      );
    });

    it("should return success message with club name", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });
      mockUserGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimantUser,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      const result = await callApproveClubClaim({ clubId: "repton-abc" }, context);

      expect(result.message).toContain("Repton Amateur Boxing Club");
      expect(result.message).toContain("approved");
    });
  });

  describe("Approve creates member document (AC: 3, Task 6.3)", () => {
    it("should create member document with correct fields", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });
      mockUserGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimantUser,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      await callApproveClubClaim({ clubId: "repton-abc" }, context);

      expect(mockTransactionSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: "claimant-user-123",
          displayName: "John Claimant",
          role: "chair",
          joinedAt: mockTimestamp,
          updatedAt: mockTimestamp,
        })
      );
    });

    it("should set member role to chair for first member", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });
      mockUserGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimantUser,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      await callApproveClubClaim({ clubId: "repton-abc" }, context);

      expect(mockTransactionSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          role: "chair",
        })
      );
    });

    it("should use email as displayName fallback", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });
      mockUserGet.mockResolvedValue({
        exists: true,
        data: () => ({ email: "fallback@example.com" }), // No displayName
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      await callApproveClubClaim({ clubId: "repton-abc" }, context);

      expect(mockTransactionSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          displayName: "fallback@example.com",
        })
      );
    });
  });

  describe("Approve updates user clubMemberships (AC: 3, Task 6.4)", () => {
    it("should add clubId to user's clubMemberships array", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });
      mockUserGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimantUser,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      await callApproveClubClaim({ clubId: "repton-abc" }, context);

      // Should update user with arrayUnion for clubMemberships
      expect(mockTransactionUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          clubMemberships: expect.objectContaining({ __arrayUnion: "repton-abc" }),
          updatedAt: mockTimestamp,
        })
      );
    });
  });

  describe("Approve on non-pending club fails (AC: 2, Task 6.5)", () => {
    it("should reject approval of unclaimed club", async () => {
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
        callApproveClubClaim({ clubId: "dale-youth-abc" }, context)
      ).rejects.toMatchObject({
        code: "failed-precondition",
        message: expect.stringContaining("not pending approval"),
      });
    });

    it("should reject approval of already claimed club", async () => {
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
        callApproveClubClaim({ clubId: "sheffield-city-abc" }, context)
      ).rejects.toMatchObject({
        code: "failed-precondition",
      });
    });

    it("should reject approval of club without claimedBy", async () => {
      const clubWithoutClaimant = {
        ...mockClaimPendingClub,
        claimedBy: null,
      };
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => clubWithoutClaimant,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
      };

      await expect(
        callApproveClubClaim({ clubId: "repton-abc" }, context)
      ).rejects.toMatchObject({
        code: "failed-precondition",
        message: expect.stringContaining("no claimant"),
      });
    });
  });

  describe("Audit logging (AC: 4, Task 6.6)", () => {
    it("should write audit log entry on successful approval", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });
      mockUserGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimantUser,
      });

      const context = {
        auth: {
          uid: "admin-actor",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "192.168.1.1" },
      };

      await callApproveClubClaim({ clubId: "repton-abc" }, context);

      expect(mockAuditLogSet).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "club.claim.approved",
          actorId: "admin-actor",
          actorType: "admin",
          targetType: "club",
          targetId: "repton-abc",
          targetClubId: "repton-abc",
          details: expect.objectContaining({
            clubName: "Repton Amateur Boxing Club",
            claimantId: "claimant-user-123",
            previousStatus: "claim_pending",
            newStatus: "claimed",
          }),
        })
      );
    });

    it("should include IP address in audit log", async () => {
      mockClubGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });
      mockUserGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimantUser,
      });

      const context = {
        auth: {
          uid: "admin-user",
          token: { isPlatformAdmin: true },
        },
        rawRequest: { ip: "10.0.0.1" },
      };

      await callApproveClubClaim({ clubId: "repton-abc" }, context);

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
        callApproveClubClaim({}, adminContext)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject empty clubId", async () => {
      await expect(
        callApproveClubClaim({ clubId: "" }, adminContext)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject non-existent club", async () => {
      mockClubGet.mockResolvedValue({
        exists: false,
      });

      await expect(
        callApproveClubClaim({ clubId: "nonexistent-club" }, adminContext)
      ).rejects.toMatchObject({
        code: "not-found",
      });
    });
  });
});
