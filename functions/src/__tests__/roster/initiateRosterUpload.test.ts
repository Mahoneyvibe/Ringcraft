/**
 * Unit Tests for initiateRosterUpload Cloud Function
 *
 * Story 4.1: Upload Draft Roster (CSV)
 *
 * Tests the callable function that initiates roster uploads.
 */

// Mock data
const mockClubId = "test-club-abc";
const mockUserId = "test-user-xyz";
const mockImportId = "generated-import-id";

// Track created documents
let createdRosterImport: Record<string, unknown> | null = null;

// Mock member document state
let mockMemberExists = true;
let mockClubExists = true;
let mockClubStatus = "claimed";

// Mock Timestamp
const mockTimestampInstance = { toDate: () => new Date() };
const mockTimestamp = {
  now: jest.fn().mockReturnValue(mockTimestampInstance),
};

// Mock Firestore refs
const mockMemberRef = {
  get: jest.fn(),
};

const mockClubRef = {
  get: jest.fn(),
};

const mockImportRef = {
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
                if (subcol === "rosterImports") {
                  return {
                    doc: jest.fn().mockReturnValue(mockImportRef),
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
    return { doc: jest.fn() };
  }),
};

// Create the firestore mock function with Timestamp property
const firestoreMock = Object.assign(
  jest.fn(() => mockFirestore),
  { Timestamp: mockTimestamp }
);

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

// Mock uuid
jest.mock("uuid", () => ({
  v4: jest.fn(() => mockImportId),
}));

// Import after mocking
import { initiateRosterUpload } from "../../roster/initiateRosterUpload";

// Type assertion for the mocked callable function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callInitiateRosterUpload = initiateRosterUpload as any;

describe("initiateRosterUpload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createdRosterImport = null;
    mockMemberExists = true;
    mockClubExists = true;
    mockClubStatus = "claimed";

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

    mockImportRef.set.mockImplementation((data) => {
      createdRosterImport = data;
      return Promise.resolve();
    });
  });

  describe("Authentication (AC: 1)", () => {
    it("should reject unauthenticated calls", async () => {
      const context = { auth: null };

      await expect(
        callInitiateRosterUpload({ clubId: mockClubId }, context)
      ).rejects.toMatchObject({
        code: "unauthenticated",
      });
    });

    it("should accept authenticated calls from club members", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      const result = await callInitiateRosterUpload(
        { clubId: mockClubId },
        context
      );

      expect(result).toHaveProperty("importId");
      expect(result).toHaveProperty("storagePath");
    });
  });

  describe("Club membership validation (AC: 1)", () => {
    it("should reject users not in the club", async () => {
      mockMemberRef.get.mockResolvedValue({ exists: false });

      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callInitiateRosterUpload({ clubId: mockClubId }, context)
      ).rejects.toMatchObject({
        code: "permission-denied",
      });
    });

    it("should accept users who are club members", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      const result = await callInitiateRosterUpload(
        { clubId: mockClubId },
        context
      );

      expect(result).toHaveProperty("importId", mockImportId);
    });
  });

  describe("Club validation", () => {
    it("should reject if club does not exist", async () => {
      mockClubRef.get.mockResolvedValue({ exists: false });

      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callInitiateRosterUpload({ clubId: mockClubId }, context)
      ).rejects.toMatchObject({
        code: "not-found",
      });
    });

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
        callInitiateRosterUpload({ clubId: mockClubId }, context)
      ).rejects.toMatchObject({
        code: "failed-precondition",
      });
    });
  });

  describe("Storage path generation (AC: 1)", () => {
    it("should return valid storagePath for club", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      const result = await callInitiateRosterUpload(
        { clubId: mockClubId },
        context
      );

      expect(result.storagePath).toBe(
        `clubs/${mockClubId}/rosters/${mockImportId}.csv`
      );
    });

    it("should return importId matching the generated UUID", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      const result = await callInitiateRosterUpload(
        { clubId: mockClubId },
        context
      );

      expect(result.importId).toBe(mockImportId);
    });
  });

  describe("RosterImport document creation (AC: 1)", () => {
    it("should create rosterImport document with status=pending", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await callInitiateRosterUpload({ clubId: mockClubId }, context);

      expect(createdRosterImport).not.toBeNull();
      expect(createdRosterImport).toHaveProperty("status", "pending");
    });

    it("should set correct importId and fileName", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await callInitiateRosterUpload({ clubId: mockClubId }, context);

      expect(createdRosterImport).toHaveProperty("importId", mockImportId);
      expect(createdRosterImport).toHaveProperty(
        "fileName",
        `${mockImportId}.csv`
      );
    });

    it("should set uploadedBy to the calling user", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await callInitiateRosterUpload({ clubId: mockClubId }, context);

      expect(createdRosterImport).toHaveProperty("uploadedBy", mockUserId);
    });

    it("should initialize boxersCreated to 0 and errors to empty array", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await callInitiateRosterUpload({ clubId: mockClubId }, context);

      expect(createdRosterImport).toHaveProperty("boxersCreated", 0);
      expect(createdRosterImport).toHaveProperty("errors", []);
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
        callInitiateRosterUpload({}, context)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject non-string clubId", async () => {
      const context = {
        auth: {
          uid: mockUserId,
          token: {},
        },
      };

      await expect(
        callInitiateRosterUpload({ clubId: 123 }, context)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });
  });
});
