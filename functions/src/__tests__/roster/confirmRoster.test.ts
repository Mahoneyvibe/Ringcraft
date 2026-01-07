/**
 * Unit Tests for confirmRoster Cloud Function
 *
 * Story 4.2: Confirm Roster
 *
 * Tests the callable function that confirms draft boxers.
 */

// Mock data
const mockClubId = "test-club-abc";
const mockUserId = "test-user-xyz";
const mockBoxerId1 = "boxer-1";
const mockBoxerId2 = "boxer-2";
const mockBoxerId3 = "boxer-3";

// Track updated boxers
const updatedBoxers: Map<string, Record<string, unknown>> = new Map();

// Track created audit logs
let createdAuditLog: Record<string, unknown> | null = null;

// Mock member document state
let mockMemberExists = true;
let mockClubExists = true;
let mockClubStatus = "claimed";

// Mock boxer state
const mockBoxers: Map<string, { exists: boolean; data: Record<string, unknown> }> = new Map();

// Mock Timestamp
const mockTimestampInstance = { toDate: () => new Date() };
const mockTimestamp = {
  now: jest.fn().mockReturnValue(mockTimestampInstance),
};

// Mock batch
const mockBatch = {
  update: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
};

// Mock Firestore refs
const mockMemberRef = {
  get: jest.fn(),
};

const mockClubRef = {
  get: jest.fn(),
};

const mockAuditLogRef = {
  id: "audit-log-123",
  set: jest.fn(),
};

const mockFirestore = {
  collection: jest.fn().mockImplementation((path) => {
    if (path === "clubs") {
      return {
        doc: jest.fn().mockImplementation((clubId) => {
          if (clubId === mockClubId) {
            return {
              ...mockClubRef,
              collection: jest.fn().mockImplementation((subcol) => {
                if (subcol === "members") {
                  return {
                    doc: jest.fn().mockReturnValue(mockMemberRef),
                  };
                }
                if (subcol === "boxers") {
                  return {
                    doc: jest.fn().mockImplementation((boxerId) => {
                      const boxer = mockBoxers.get(boxerId);
                      return {
                        get: jest.fn().mockResolvedValue({
                          exists: boxer?.exists ?? false,
                          data: () => boxer?.data,
                          ref: { id: boxerId },
                        }),
                        ref: { id: boxerId },
                      };
                    }),
                  };
                }
                return { doc: jest.fn() };
              }),
            };
          }
          return {
            get: jest.fn().mockResolvedValue({ exists: false }),
            collection: jest.fn(),
          };
        }),
      };
    }
    if (path === "admin") {
      return {
        doc: jest.fn().mockImplementation((docId) => {
          if (docId === "auditLogs") {
            return {
              collection: jest.fn().mockImplementation(() => ({
                doc: jest.fn().mockReturnValue(mockAuditLogRef),
              })),
            };
          }
          return { get: jest.fn() };
        }),
      };
    }
    return { doc: jest.fn() };
  }),
  batch: jest.fn().mockReturnValue(mockBatch),
};

// Create the firestore mock function with Timestamp property
const firestoreMock = Object.assign(jest.fn(() => mockFirestore), {
  Timestamp: mockTimestamp,
});

// Mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: firestoreMock,
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
import { confirmRoster } from "../../roster/confirmRoster";

// Type assertion for the mocked callable function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callConfirmRoster = confirmRoster as any;

describe("confirmRoster", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updatedBoxers.clear();
    createdAuditLog = null;
    mockMemberExists = true;
    mockClubExists = true;
    mockClubStatus = "claimed";
    mockBoxers.clear();

    // Reset mock implementations
    mockMemberRef.get.mockResolvedValue({
      exists: mockMemberExists,
    });

    mockClubRef.get.mockResolvedValue({
      exists: mockClubExists,
      data: () => ({
        status: mockClubStatus,
        name: "Test Club",
      }),
    });

    mockAuditLogRef.set.mockImplementation((data) => {
      createdAuditLog = data;
      return Promise.resolve();
    });

    mockBatch.update.mockImplementation((ref, data) => {
      updatedBoxers.set(ref.id, data);
    });

    mockBatch.commit.mockResolvedValue(undefined);

    // Set up default draft boxers
    mockBoxers.set(mockBoxerId1, {
      exists: true,
      data: {
        boxerId: mockBoxerId1,
        firstName: "John",
        lastName: "Doe",
        dataStatus: "draft",
      },
    });

    mockBoxers.set(mockBoxerId2, {
      exists: true,
      data: {
        boxerId: mockBoxerId2,
        firstName: "Jane",
        lastName: "Smith",
        dataStatus: "draft",
      },
    });
  });

  describe("Authentication (Test 3.1)", () => {
    it("should reject unauthenticated calls", async () => {
      const context = { auth: null };

      await expect(
        callConfirmRoster(
          { clubId: mockClubId, boxerIds: [mockBoxerId1] },
          context
        )
      ).rejects.toMatchObject({
        code: "unauthenticated",
      });
    });
  });

  describe("Club membership validation (Test 3.2)", () => {
    it("should reject users not in the club", async () => {
      mockMemberRef.get.mockResolvedValue({ exists: false });

      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callConfirmRoster(
          { clubId: mockClubId, boxerIds: [mockBoxerId1] },
          context
        )
      ).rejects.toMatchObject({
        code: "permission-denied",
      });
    });
  });

  describe("Club validation (Test 3.3)", () => {
    it("should reject if club is not claimed", async () => {
      mockClubRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ status: "unclaimed" }),
      });

      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callConfirmRoster(
          { clubId: mockClubId, boxerIds: [mockBoxerId1] },
          context
        )
      ).rejects.toMatchObject({
        code: "failed-precondition",
      });
    });

    it("should reject if club does not exist", async () => {
      mockClubRef.get.mockResolvedValue({ exists: false });

      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callConfirmRoster(
          { clubId: mockClubId, boxerIds: [mockBoxerId1] },
          context
        )
      ).rejects.toMatchObject({
        code: "not-found",
      });
    });
  });

  describe("Success path (Tests 3.4, 3.5, 3.12)", () => {
    it("should confirm specified draft boxers", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      const result = await callConfirmRoster(
        { clubId: mockClubId, boxerIds: [mockBoxerId1, mockBoxerId2] },
        context
      );

      expect(result.success).toBe(true);
      expect(result.confirmedCount).toBe(2);
      expect(result.boxerIds).toContain(mockBoxerId1);
      expect(result.boxerIds).toContain(mockBoxerId2);
    });

    it("should update boxers to dataStatus=active", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await callConfirmRoster(
        { clubId: mockClubId, boxerIds: [mockBoxerId1] },
        context
      );

      expect(mockBatch.update).toHaveBeenCalled();
      const updateData = updatedBoxers.get(mockBoxerId1);
      expect(updateData).toHaveProperty("dataStatus", "active");
    });

    it("should set lastModifiedBy to calling user", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await callConfirmRoster(
        { clubId: mockClubId, boxerIds: [mockBoxerId1] },
        context
      );

      const updateData = updatedBoxers.get(mockBoxerId1);
      expect(updateData).toHaveProperty("lastModifiedBy", mockUserId);
    });

    it("should return correct count of confirmed boxers", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      const result = await callConfirmRoster(
        { clubId: mockClubId, boxerIds: [mockBoxerId1, mockBoxerId2] },
        context
      );

      expect(result.confirmedCount).toBe(2);
    });
  });

  describe("Boxers not in request remain draft (Test 3.6)", () => {
    it("should only update specified boxers", async () => {
      // Add a third boxer that won't be confirmed
      mockBoxers.set(mockBoxerId3, {
        exists: true,
        data: {
          boxerId: mockBoxerId3,
          firstName: "Bob",
          lastName: "Wilson",
          dataStatus: "draft",
        },
      });

      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await callConfirmRoster(
        { clubId: mockClubId, boxerIds: [mockBoxerId1] },
        context
      );

      // Only boxer1 should be updated
      expect(updatedBoxers.has(mockBoxerId1)).toBe(true);
      expect(updatedBoxers.has(mockBoxerId3)).toBe(false);
    });
  });

  describe("Already active boxer (Test 3.7)", () => {
    it("should reject if boxer is already active", async () => {
      mockBoxers.set(mockBoxerId1, {
        exists: true,
        data: {
          boxerId: mockBoxerId1,
          firstName: "John",
          lastName: "Doe",
          dataStatus: "active",
        },
      });

      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callConfirmRoster(
          { clubId: mockClubId, boxerIds: [mockBoxerId1] },
          context
        )
      ).rejects.toMatchObject({
        code: "failed-precondition",
        message: expect.stringContaining("already active"),
      });
    });
  });

  describe("Non-existent boxer (Test 3.8)", () => {
    it("should reject if boxer does not exist", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callConfirmRoster(
          { clubId: mockClubId, boxerIds: ["non-existent-boxer"] },
          context
        )
      ).rejects.toMatchObject({
        code: "not-found",
        message: expect.stringContaining("not found"),
      });
    });
  });

  describe("Boxer from another club (Test 3.9)", () => {
    it("should reject if boxer belongs to another club", async () => {
      // This is implicitly tested - boxer not found in this club's boxers collection
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      // Clear boxers so the lookup fails
      mockBoxers.clear();

      await expect(
        callConfirmRoster(
          { clubId: mockClubId, boxerIds: [mockBoxerId1] },
          context
        )
      ).rejects.toMatchObject({
        code: "not-found",
      });
    });
  });

  describe("Empty boxerIds array (Test 3.10)", () => {
    it("should reject empty boxerIds array", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callConfirmRoster({ clubId: mockClubId, boxerIds: [] }, context)
      ).rejects.toMatchObject({
        code: "invalid-argument",
        message: expect.stringContaining("cannot be empty"),
      });
    });
  });

  describe("Audit log (Test 3.11)", () => {
    it("should write audit log on successful confirmation", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
        rawRequest: { ip: "127.0.0.1" },
      };

      await callConfirmRoster(
        { clubId: mockClubId, boxerIds: [mockBoxerId1] },
        context
      );

      expect(mockAuditLogRef.set).toHaveBeenCalled();
      expect(createdAuditLog).not.toBeNull();
      expect(createdAuditLog).toHaveProperty("action", "roster.confirmed");
      expect(createdAuditLog).toHaveProperty("actorId", mockUserId);
      expect(createdAuditLog).toHaveProperty("actorType", "user");
      expect(createdAuditLog).toHaveProperty("targetType", "club");
      expect(createdAuditLog).toHaveProperty("targetId", mockClubId);
      expect(createdAuditLog).toHaveProperty("details");
      expect((createdAuditLog as Record<string, unknown>).details).toHaveProperty("confirmedCount", 1);
      expect((createdAuditLog as Record<string, unknown>).details).toHaveProperty("boxerIds");
    });
  });

  describe("Partial confirmation (Test 3.13)", () => {
    it("should reject if any boxer is invalid (all or nothing)", async () => {
      // First boxer is valid, second doesn't exist
      mockBoxers.set(mockBoxerId1, {
        exists: true,
        data: {
          boxerId: mockBoxerId1,
          firstName: "John",
          lastName: "Doe",
          dataStatus: "draft",
        },
      });
      // mockBoxerId2 not set, so it won't exist

      mockBoxers.delete(mockBoxerId2);

      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callConfirmRoster(
          { clubId: mockClubId, boxerIds: [mockBoxerId1, mockBoxerId2] },
          context
        )
      ).rejects.toMatchObject({
        code: "not-found",
      });

      // Verify no boxers were updated
      expect(mockBatch.commit).not.toHaveBeenCalled();
    });
  });

  describe("Archived boxer (Test 3.14)", () => {
    it("should reject if boxer is archived", async () => {
      mockBoxers.set(mockBoxerId1, {
        exists: true,
        data: {
          boxerId: mockBoxerId1,
          firstName: "John",
          lastName: "Doe",
          dataStatus: "archived",
        },
      });

      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callConfirmRoster(
          { clubId: mockClubId, boxerIds: [mockBoxerId1] },
          context
        )
      ).rejects.toMatchObject({
        code: "failed-precondition",
        message: expect.stringContaining("archived"),
      });
    });
  });

  describe("Input validation", () => {
    it("should reject missing clubId", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callConfirmRoster({ boxerIds: [mockBoxerId1] }, context)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject missing boxerIds", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callConfirmRoster({ clubId: mockClubId }, context)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject non-array boxerIds", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callConfirmRoster(
          { clubId: mockClubId, boxerIds: "not-an-array" },
          context
        )
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject boxerIds with empty strings", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callConfirmRoster({ clubId: mockClubId, boxerIds: [""] }, context)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });
  });
});
