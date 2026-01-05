/**
 * Unit Tests for claimClub Cloud Function
 *
 * Story 2.2: Claim a Club
 *
 * These tests use mocks to run offline without the Firebase emulator.
 */

// Mock Timestamp
const mockTimestamp = { seconds: 1234567890, nanoseconds: 0 };

// Mock club data
const mockUnclaimedClub = {
  clubId: "repton-abc",
  name: "Repton Amateur Boxing Club",
  region: "London",
  status: "unclaimed",
  claimedBy: null,
  claimedAt: null,
};

const mockClaimPendingClub = {
  clubId: "dale-youth-abc",
  name: "Dale Youth Amateur Boxing Club",
  region: "London",
  status: "claim_pending",
  claimedBy: "other-user-123",
  claimedAt: null,
};

const mockClaimedClub = {
  clubId: "sheffield-city-abc",
  name: "Sheffield City Amateur Boxing Club",
  region: "Yorkshire",
  status: "claimed",
  claimedBy: "club-owner-456",
  claimedAt: mockTimestamp,
};

// Mock Firestore operations
const mockUpdate = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn();
const mockAuditLogSet = jest.fn().mockResolvedValue(undefined);
const mockAuditLogDoc = jest.fn().mockReturnValue({
  id: "mock-audit-log-id",
  set: mockAuditLogSet,
});

const mockClubDoc = jest.fn().mockReturnValue({
  get: mockGet,
  update: mockUpdate,
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
          return { doc: mockClubDoc };
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
import { claimClub } from "../../clubs/claimClub";

// Type assertion for the mocked callable function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callClaimClub = claimClub as any;

describe("claimClub", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication (AC: 1, Task 5.1)", () => {
    it("should reject unauthenticated calls", async () => {
      const context = { auth: null };

      await expect(
        callClaimClub({ clubId: "repton-abc" }, context)
      ).rejects.toMatchObject({
        code: "unauthenticated",
      });
    });

    it("should accept authenticated calls", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockUnclaimedClub,
      });

      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      const result = await callClaimClub({ clubId: "repton-abc" }, context);

      expect(result.success).toBe(true);
    });
  });

  describe("Claim unclaimed club (AC: 1, Task 5.2)", () => {
    it("should set club to claim_pending and set claimedBy", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockUnclaimedClub,
      });

      const context = {
        auth: {
          uid: "claiming-user",
          token: {},
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      const result = await callClaimClub({ clubId: "repton-abc" }, context);

      expect(result.success).toBe(true);
      expect(result.message).toContain("Awaiting admin approval");
      expect(mockUpdate).toHaveBeenCalledWith({
        status: "claim_pending",
        claimedBy: "claiming-user",
        updatedAt: mockTimestamp,
      });
    });

    it("should return success message with club name", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockUnclaimedClub,
      });

      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      const result = await callClaimClub({ clubId: "repton-abc" }, context);

      expect(result.message).toContain("Repton Amateur Boxing Club");
    });
  });

  describe("Claim already claimed club (AC: 1, Task 5.3)", () => {
    it("should reject claim on claimed club", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimedClub,
      });

      const context = {
        auth: {
          uid: "new-claimant",
          token: {},
        },
      };

      await expect(
        callClaimClub({ clubId: "sheffield-city-abc" }, context)
      ).rejects.toMatchObject({
        code: "failed-precondition",
        message: expect.stringContaining("not available for claiming"),
      });
    });

    it("should include current status in error message", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimedClub,
      });

      const context = {
        auth: {
          uid: "new-claimant",
          token: {},
        },
      };

      await expect(
        callClaimClub({ clubId: "sheffield-city-abc" }, context)
      ).rejects.toMatchObject({
        message: expect.stringContaining("claimed"),
      });
    });
  });

  describe("Claim club in claim_pending status (AC: 1, Task 5.4)", () => {
    it("should reject claim on club with pending claim", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockClaimPendingClub,
      });

      const context = {
        auth: {
          uid: "another-claimant",
          token: {},
        },
      };

      await expect(
        callClaimClub({ clubId: "dale-youth-abc" }, context)
      ).rejects.toMatchObject({
        code: "failed-precondition",
        message: expect.stringContaining("not available for claiming"),
      });
    });
  });

  describe("Audit logging (AC: 4, Task 5.5)", () => {
    it("should write audit log entry on successful claim", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockUnclaimedClub,
      });

      const context = {
        auth: {
          uid: "claiming-user",
          token: {},
        },
        rawRequest: { ip: "192.168.1.1" },
      };

      await callClaimClub({ clubId: "repton-abc" }, context);

      expect(mockAuditLogSet).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "club.claim.requested",
          actorId: "claiming-user",
          actorType: "user",
          targetType: "club",
          targetId: "repton-abc",
          targetClubId: "repton-abc",
          details: expect.objectContaining({
            clubName: "Repton Amateur Boxing Club",
            previousStatus: "unclaimed",
            newStatus: "claim_pending",
          }),
        })
      );
    });

    it("should include IP address in audit log when available", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockUnclaimedClub,
      });

      const context = {
        auth: {
          uid: "claiming-user",
          token: {},
        },
        rawRequest: { ip: "10.0.0.1" },
      };

      await callClaimClub({ clubId: "repton-abc" }, context);

      expect(mockAuditLogSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: "10.0.0.1",
        })
      );
    });

    it("should handle missing IP address gracefully", async () => {
      mockGet.mockResolvedValue({
        exists: true,
        data: () => mockUnclaimedClub,
      });

      const context = {
        auth: {
          uid: "claiming-user",
          token: {},
        },
        rawRequest: {},
      };

      await callClaimClub({ clubId: "repton-abc" }, context);

      expect(mockAuditLogSet).toHaveBeenCalledWith(
        expect.objectContaining({
          ipAddress: null,
        })
      );
    });
  });

  describe("Input validation", () => {
    it("should reject missing clubId", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      await expect(callClaimClub({}, context)).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject empty clubId", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      await expect(
        callClaimClub({ clubId: "" }, context)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject non-string clubId", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      await expect(
        callClaimClub({ clubId: 123 }, context)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject non-existent club", async () => {
      mockGet.mockResolvedValue({
        exists: false,
      });

      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      await expect(
        callClaimClub({ clubId: "nonexistent-club" }, context)
      ).rejects.toMatchObject({
        code: "not-found",
      });
    });
  });
});
