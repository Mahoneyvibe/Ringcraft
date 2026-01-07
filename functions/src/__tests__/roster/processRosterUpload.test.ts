/**
 * Unit Tests for processRosterUpload Cloud Function
 *
 * Story 4.1: Upload Draft Roster (CSV)
 *
 * Tests the Storage trigger that processes CSV uploads and creates draft boxers.
 */

// Track created boxers for assertions
let createdBoxers: Record<string, unknown>[] = [];
let auditLogEntries: Record<string, unknown>[] = [];
let importUpdates: Record<string, unknown>[] = [];

// Mock data
const mockImportId = "test-import-123";
const mockClubId = "test-club-abc";
const mockUserId = "test-user-xyz";

// Mock import document state
let mockImportDocExists = true;

// Mock file download contents
const mockFileContents = Buffer.from("");

// Mock Timestamp
const mockTimestampInstance = { toDate: () => new Date() };
const mockTimestamp = {
  now: jest.fn().mockReturnValue(mockTimestampInstance),
  fromDate: jest.fn().mockImplementation((date) => ({
    toDate: () => date,
  })),
};

// Mock Firestore
const mockImportRef = {
  get: jest.fn(),
  update: jest.fn(),
};

const mockBoxerRef = {
  set: jest.fn().mockResolvedValue(undefined),
};

const mockBatch = {
  set: jest.fn(),
  commit: jest.fn().mockResolvedValue(undefined),
};

const mockAuditLogRef = {
  id: "audit-log-123",
  set: jest.fn(),
};

const mockFirestore = {
  collection: jest.fn().mockImplementation((path) => {
    if (path === "admin") {
      return {
        doc: jest.fn().mockReturnValue({
          collection: jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue(mockAuditLogRef),
          }),
        }),
      };
    }
    return {
      doc: jest.fn().mockImplementation((id) => {
        if (id === mockClubId) {
          return {
            collection: jest.fn().mockImplementation((subcol) => {
              if (subcol === "rosterImports") {
                return {
                  doc: jest.fn().mockReturnValue(mockImportRef),
                };
              }
              if (subcol === "boxers") {
                return {
                  doc: jest.fn().mockReturnValue(mockBoxerRef),
                };
              }
              return { doc: jest.fn() };
            }),
          };
        }
        return { collection: jest.fn() };
      }),
    };
  }),
  batch: jest.fn().mockReturnValue(mockBatch),
};

// Mock storage
const mockFile = {
  download: jest.fn(),
};
const mockBucket = {
  file: jest.fn().mockReturnValue(mockFile),
};
const mockStorage = {
  bucket: jest.fn().mockReturnValue(mockBucket),
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
  storage: jest.fn(() => mockStorage),
}));

// Mock firebase-admin/firestore
jest.mock("firebase-admin/firestore", () => ({
  Timestamp: mockTimestamp,
}));

// Mock firebase-functions
jest.mock("firebase-functions", () => ({
  storage: {
    object: jest.fn().mockReturnValue({
      onFinalize: jest.fn((handler) => handler),
    }),
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock uuid
let uuidCounter = 0;
jest.mock("uuid", () => ({
  v4: jest.fn(() => `unique-boxer-id-${++uuidCounter}`),
}));

// Import after mocking
import { processRosterUpload } from "../../roster/processRosterUpload";

// Type assertion for the mocked storage trigger
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callProcessRosterUpload = processRosterUpload as any;

describe("processRosterUpload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    createdBoxers = [];
    auditLogEntries = [];
    importUpdates = [];
    mockImportDocExists = true;
    uuidCounter = 0;

    // Reset mock implementations
    mockImportRef.get.mockResolvedValue({
      exists: mockImportDocExists,
      data: () => ({
        importId: mockImportId,
        fileName: `${mockImportId}.csv`,
        storagePath: `clubs/${mockClubId}/rosters/${mockImportId}.csv`,
        status: "pending",
        boxersCreated: 0,
        errors: [],
        uploadedBy: mockUserId,
        uploadedAt: mockTimestampInstance,
        processedAt: null,
      }),
    });

    mockImportRef.update.mockImplementation((data) => {
      importUpdates.push(data);
      return Promise.resolve();
    });

    mockBatch.set.mockImplementation((ref, data) => {
      createdBoxers.push(data);
    });

    mockAuditLogRef.set.mockImplementation((data) => {
      auditLogEntries.push(data);
      return Promise.resolve();
    });

    mockFile.download.mockResolvedValue([mockFileContents]);
  });

  describe("Path matching", () => {
    it("should skip non-roster uploads", async () => {
      const object = {
        name: "some/other/path/file.csv",
        contentType: "text/csv",
        bucket: "test-bucket",
      };

      await callProcessRosterUpload(object);

      expect(mockFirestore.collection).not.toHaveBeenCalled();
    });

    it("should skip uploads with no file path", async () => {
      const object = {
        name: undefined,
        contentType: "text/csv",
        bucket: "test-bucket",
      };

      await callProcessRosterUpload(object);

      expect(mockFirestore.collection).not.toHaveBeenCalled();
    });

    it("should skip non-CSV files in roster path", async () => {
      const object = {
        name: `clubs/${mockClubId}/rosters/${mockImportId}.txt`,
        contentType: "text/plain",
        bucket: "test-bucket",
      };

      await callProcessRosterUpload(object);

      expect(mockFirestore.collection).not.toHaveBeenCalled();
    });
  });

  describe("Valid CSV processing (AC: 1, 2, 3)", () => {
    const validCsvContent = `firstName,lastName,dob,gender,category,declaredWeight,declaredBouts,declaredWins,declaredLosses
John,Doe,2000-05-15,male,elite,75,10,8,2
Jane,Smith,1998-03-20,female,elite,60,5,4,1`;

    beforeEach(() => {
      mockFile.download.mockResolvedValue([Buffer.from(validCsvContent)]);
    });

    it("should create boxers with dataStatus=draft (AC: 2)", async () => {
      const object = {
        name: `clubs/${mockClubId}/rosters/${mockImportId}.csv`,
        contentType: "text/csv",
        bucket: "test-bucket",
      };

      await callProcessRosterUpload(object);

      // Verify boxers were created via batch
      expect(createdBoxers.length).toBe(2);
      expect(createdBoxers[0]).toHaveProperty("dataStatus", "draft");
      expect(createdBoxers[1]).toHaveProperty("dataStatus", "draft");
    });

    it("should generate unique boxerId for each boxer (AC: 2)", async () => {
      const object = {
        name: `clubs/${mockClubId}/rosters/${mockImportId}.csv`,
        contentType: "text/csv",
        bucket: "test-bucket",
      };

      await callProcessRosterUpload(object);

      const boxerIds = createdBoxers.map((b) => b.boxerId);
      const uniqueIds = new Set(boxerIds);
      expect(uniqueIds.size).toBe(boxerIds.length);
      expect(boxerIds.length).toBe(2);
    });

    it("should update rosterImport status to completed (AC: 1)", async () => {
      const object = {
        name: `clubs/${mockClubId}/rosters/${mockImportId}.csv`,
        contentType: "text/csv",
        bucket: "test-bucket",
      };

      await callProcessRosterUpload(object);

      // Check that status was updated to processing, then completed
      expect(importUpdates).toContainEqual({ status: "processing" });
      expect(importUpdates).toContainEqual(
        expect.objectContaining({
          status: "completed",
          boxersCreated: 2,
        })
      );
    });

    it("should set boxersCreated count correctly", async () => {
      const object = {
        name: `clubs/${mockClubId}/rosters/${mockImportId}.csv`,
        contentType: "text/csv",
        bucket: "test-bucket",
      };

      await callProcessRosterUpload(object);

      const finalUpdate = importUpdates.find(
        (u) => (u as Record<string, unknown>).status === "completed"
      );
      expect(finalUpdate).toHaveProperty("boxersCreated", 2);
    });

    it("should write audit log on successful import", async () => {
      const object = {
        name: `clubs/${mockClubId}/rosters/${mockImportId}.csv`,
        contentType: "text/csv",
        bucket: "test-bucket",
      };

      await callProcessRosterUpload(object);

      expect(auditLogEntries.length).toBe(1);
      expect(auditLogEntries[0]).toHaveProperty(
        "action",
        "roster.import.completed"
      );
      expect(auditLogEntries[0]).toHaveProperty("targetId", mockClubId);
    });
  });

  describe("Invalid row handling (AC: 2)", () => {
    it("should collect errors for invalid rows and continue processing", async () => {
      const csvWithErrors = `firstName,lastName,dob,gender,category,declaredWeight
John,Doe,2000-05-15,male,elite,75
,Smith,1998-03-20,female,elite,60
Jane,Doe,invalid-date,female,elite,65`;

      mockFile.download.mockResolvedValue([Buffer.from(csvWithErrors)]);

      const object = {
        name: `clubs/${mockClubId}/rosters/${mockImportId}.csv`,
        contentType: "text/csv",
        bucket: "test-bucket",
      };

      await callProcessRosterUpload(object);

      // Should have created 1 valid boxer
      expect(createdBoxers.length).toBe(1);

      // Should have recorded 2 errors
      const finalUpdate = importUpdates.find(
        (u) => (u as Record<string, unknown>).boxersCreated !== undefined
      ) as Record<string, unknown>;
      expect(finalUpdate.errors).toHaveLength(2);
    });
  });

  describe("Empty CSV handling", () => {
    it("should complete with boxersCreated=0 for empty CSV", async () => {
      const emptyCsv = "firstName,lastName,dob,gender,category,declaredWeight";

      mockFile.download.mockResolvedValue([Buffer.from(emptyCsv)]);

      const object = {
        name: `clubs/${mockClubId}/rosters/${mockImportId}.csv`,
        contentType: "text/csv",
        bucket: "test-bucket",
      };

      await callProcessRosterUpload(object);

      expect(createdBoxers.length).toBe(0);

      const finalUpdate = importUpdates.find(
        (u) => (u as Record<string, unknown>).boxersCreated !== undefined
      );
      expect(finalUpdate).toHaveProperty("status", "completed");
      expect(finalUpdate).toHaveProperty("boxersCreated", 0);
    });
  });

  describe("Malformed CSV handling", () => {
    it("should set status to failed for malformed CSV", async () => {
      // Malformed CSV that csv-parse cannot handle
      const malformedCsv = "\"unclosed quote";

      mockFile.download.mockResolvedValue([Buffer.from(malformedCsv)]);

      const object = {
        name: `clubs/${mockClubId}/rosters/${mockImportId}.csv`,
        contentType: "text/csv",
        bucket: "test-bucket",
      };

      await callProcessRosterUpload(object);

      const finalUpdate = importUpdates.find(
        (u) => (u as Record<string, unknown>).status === "failed"
      );
      expect(finalUpdate).toBeDefined();
      expect(finalUpdate).toHaveProperty("status", "failed");
    });
  });

  describe("Missing headers handling", () => {
    it("should fail when required columns are missing", async () => {
      const missingHeadersCsv = `firstName,lastName,gender
John,Doe,male`;

      mockFile.download.mockResolvedValue([Buffer.from(missingHeadersCsv)]);

      const object = {
        name: `clubs/${mockClubId}/rosters/${mockImportId}.csv`,
        contentType: "text/csv",
        bucket: "test-bucket",
      };

      await callProcessRosterUpload(object);

      const finalUpdate = importUpdates.find(
        (u) => (u as Record<string, unknown>).status === "failed"
      );
      expect(finalUpdate).toBeDefined();
      expect(finalUpdate).toHaveProperty("status", "failed");
    });
  });

  describe("RosterImport not found", () => {
    it("should exit gracefully when rosterImport document not found", async () => {
      mockImportRef.get.mockResolvedValue({ exists: false });

      const object = {
        name: `clubs/${mockClubId}/rosters/${mockImportId}.csv`,
        contentType: "text/csv",
        bucket: "test-bucket",
      };

      await callProcessRosterUpload(object);

      // Should not have updated anything
      expect(importUpdates.length).toBe(0);
      expect(createdBoxers.length).toBe(0);
    });
  });
});
