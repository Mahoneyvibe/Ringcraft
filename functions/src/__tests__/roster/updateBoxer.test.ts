/**
 * Unit Tests for updateBoxer Cloud Function
 *
 * Story 4.3: Edit Boxer Profile
 *
 * Tests the callable function that updates boxer details.
 */

// Mock data
const mockClubId = "test-club-abc";
const mockUserId = "test-user-xyz";
const mockBoxerId = "boxer-1";

// Track updated data
let updatedBoxerData: Record<string, unknown> | null = null;

// Mock member document state
let mockMemberExists = true;

// Mock boxer state
let mockBoxerExists = true;
let mockBoxerData: Record<string, unknown> = {
  boxerId: mockBoxerId,
  firstName: "John",
  lastName: "Doe",
  dob: { toDate: () => new Date("2000-01-15") },
  gender: "male",
  category: "elite",
  declaredWeight: 75,
  declaredBouts: 10,
  declaredWins: 7,
  declaredLosses: 3,
  dataStatus: "active",
  availability: "available",
  notes: null,
  createdAt: { toDate: () => new Date() },
  updatedAt: { toDate: () => new Date() },
  createdBy: "original-user",
  lastModifiedBy: "original-user",
};

// Mock Timestamp
const mockTimestampInstance = { toDate: () => new Date() };
const mockTimestamp = {
  now: jest.fn().mockReturnValue(mockTimestampInstance),
  fromDate: jest.fn().mockReturnValue(mockTimestampInstance),
};

// Mock Firestore refs
const mockMemberRef = {
  get: jest.fn(),
};

const mockBoxerRef = {
  get: jest.fn(),
  update: jest.fn(),
};

const mockFirestore = {
  collection: jest.fn().mockImplementation((path) => {
    if (path === "clubs") {
      return {
        doc: jest.fn().mockImplementation((clubId) => {
          if (clubId === mockClubId) {
            return {
              collection: jest.fn().mockImplementation((subcol) => {
                if (subcol === "members") {
                  return {
                    doc: jest.fn().mockReturnValue(mockMemberRef),
                  };
                }
                if (subcol === "boxers") {
                  return {
                    doc: jest.fn().mockImplementation((boxerId) => {
                      if (boxerId === mockBoxerId) {
                        return mockBoxerRef;
                      }
                      return {
                        get: jest.fn().mockResolvedValue({ exists: false }),
                        update: jest.fn(),
                      };
                    }),
                  };
                }
                return { doc: jest.fn() };
              }),
            };
          }
          return {
            collection: jest.fn().mockReturnValue({
              doc: jest.fn().mockReturnValue({
                get: jest.fn().mockResolvedValue({ exists: false }),
              }),
            }),
          };
        }),
      };
    }
    return { doc: jest.fn() };
  }),
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
import { updateBoxer } from "../../roster/updateBoxer";

// Type assertion for the mocked callable function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callUpdateBoxer = updateBoxer as any;

describe("updateBoxer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    updatedBoxerData = null;
    mockMemberExists = true;
    mockBoxerExists = true;
    mockBoxerData = {
      boxerId: mockBoxerId,
      firstName: "John",
      lastName: "Doe",
      dob: { toDate: () => new Date("2000-01-15") },
      gender: "male",
      category: "elite",
      declaredWeight: 75,
      declaredBouts: 10,
      declaredWins: 7,
      declaredLosses: 3,
      dataStatus: "active",
      availability: "available",
      notes: null,
      createdAt: { toDate: () => new Date() },
      updatedAt: { toDate: () => new Date() },
      createdBy: "original-user",
      lastModifiedBy: "original-user",
    };

    // Reset mock implementations
    mockMemberRef.get.mockResolvedValue({
      exists: mockMemberExists,
    });

    mockBoxerRef.get.mockImplementation(() =>
      Promise.resolve({
        exists: mockBoxerExists,
        data: () => mockBoxerData,
      })
    );

    mockBoxerRef.update.mockImplementation((data) => {
      updatedBoxerData = data;
      // Update mockBoxerData for subsequent get calls
      mockBoxerData = { ...mockBoxerData, ...data };
      return Promise.resolve();
    });
  });

  describe("Authentication (Test 3.1)", () => {
    it("should reject unauthenticated calls", async () => {
      const context = { auth: null };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: mockBoxerId,
            updates: { firstName: "Jane" },
          },
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
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: mockBoxerId,
            updates: { firstName: "Jane" },
          },
          context
        )
      ).rejects.toMatchObject({
        code: "permission-denied",
      });
    });
  });

  describe("Boxer existence (Test 3.3)", () => {
    it("should reject if boxer does not exist", async () => {
      mockBoxerRef.get.mockResolvedValue({ exists: false });

      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: mockBoxerId,
            updates: { firstName: "Jane" },
          },
          context
        )
      ).rejects.toMatchObject({
        code: "not-found",
      });
    });
  });

  describe("Boxer from another club (Test 3.4)", () => {
    it("should reject if boxer belongs to another club", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: "non-existent-boxer",
            updates: { firstName: "Jane" },
          },
          context
        )
      ).rejects.toMatchObject({
        code: "not-found",
      });
    });
  });

  describe("Success path (Test 3.5)", () => {
    it("should update boxer fields successfully", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callUpdateBoxer(
        {
          clubId: mockClubId,
          boxerId: mockBoxerId,
          updates: { firstName: "Jane", lastName: "Smith" },
        },
        context
      );

      expect(result.success).toBe(true);
      expect(mockBoxerRef.update).toHaveBeenCalled();
      expect(updatedBoxerData).toHaveProperty("firstName", "Jane");
      expect(updatedBoxerData).toHaveProperty("lastName", "Smith");
    });
  });

  describe("updatedAt timestamp (Test 3.6)", () => {
    it("should set updatedAt to current timestamp", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await callUpdateBoxer(
        {
          clubId: mockClubId,
          boxerId: mockBoxerId,
          updates: { firstName: "Jane" },
        },
        context
      );

      expect(updatedBoxerData).toHaveProperty("updatedAt");
      expect(mockTimestamp.now).toHaveBeenCalled();
    });
  });

  describe("lastModifiedBy (Test 3.7)", () => {
    it("should set lastModifiedBy to caller userId", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await callUpdateBoxer(
        {
          clubId: mockClubId,
          boxerId: mockBoxerId,
          updates: { firstName: "Jane" },
        },
        context
      );

      expect(updatedBoxerData).toHaveProperty("lastModifiedBy", mockUserId);
    });
  });

  describe("Immutable field: boxerId (Test 3.8)", () => {
    it("should reject attempts to modify boxerId", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: mockBoxerId,
            updates: { boxerId: "new-id" },
          },
          context
        )
      ).rejects.toMatchObject({
        code: "invalid-argument",
        message: expect.stringContaining("boxerId"),
      });
    });
  });

  describe("Immutable field: createdAt (Test 3.9)", () => {
    it("should reject attempts to modify createdAt", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: mockBoxerId,
            updates: { createdAt: "2020-01-01" },
          },
          context
        )
      ).rejects.toMatchObject({
        code: "invalid-argument",
        message: expect.stringContaining("createdAt"),
      });
    });
  });

  describe("Immutable field: createdBy (Test 3.10)", () => {
    it("should reject attempts to modify createdBy", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: mockBoxerId,
            updates: { createdBy: "another-user" },
          },
          context
        )
      ).rejects.toMatchObject({
        code: "invalid-argument",
        message: expect.stringContaining("createdBy"),
      });
    });
  });

  describe("Partial updates (Test 3.11)", () => {
    it("should only update specified fields", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await callUpdateBoxer(
        {
          clubId: mockClubId,
          boxerId: mockBoxerId,
          updates: { firstName: "Jane" },
        },
        context
      );

      // Should have firstName, updatedAt, lastModifiedBy
      expect(updatedBoxerData).toHaveProperty("firstName", "Jane");
      expect(updatedBoxerData).toHaveProperty("updatedAt");
      expect(updatedBoxerData).toHaveProperty("lastModifiedBy");
      // Should NOT have other fields in the update
      expect(updatedBoxerData).not.toHaveProperty("lastName");
      expect(updatedBoxerData).not.toHaveProperty("gender");
    });
  });

  describe("Returns updated boxer (Test 3.12)", () => {
    it("should return the updated boxer data", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callUpdateBoxer(
        {
          clubId: mockClubId,
          boxerId: mockBoxerId,
          updates: { firstName: "Jane" },
        },
        context
      );

      expect(result.success).toBe(true);
      expect(result.boxer).toBeDefined();
      expect(result.boxer.boxerId).toBe(mockBoxerId);
    });
  });

  describe("Empty updates (Test 3.13)", () => {
    it("should reject empty updates object", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: mockBoxerId,
            updates: {},
          },
          context
        )
      ).rejects.toMatchObject({
        code: "invalid-argument",
        message: expect.stringContaining("empty"),
      });
    });
  });

  describe("Invalid field type (Test 3.14)", () => {
    it("should reject invalid field types", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: mockBoxerId,
            updates: { declaredWeight: "not-a-number" },
          },
          context
        )
      ).rejects.toMatchObject({
        code: "invalid-argument",
        message: expect.stringContaining("declaredWeight"),
      });
    });

    it("should reject invalid gender value", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: mockBoxerId,
            updates: { gender: "invalid" },
          },
          context
        )
      ).rejects.toMatchObject({
        code: "invalid-argument",
        message: expect.stringContaining("gender"),
      });
    });

    it("should reject invalid dataStatus value", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: mockBoxerId,
            updates: { dataStatus: "invalid" },
          },
          context
        )
      ).rejects.toMatchObject({
        code: "invalid-argument",
        message: expect.stringContaining("dataStatus"),
      });
    });

    it("should reject invalid availability value", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: mockBoxerId,
            updates: { availability: "invalid" },
          },
          context
        )
      ).rejects.toMatchObject({
        code: "invalid-argument",
        message: expect.stringContaining("availability"),
      });
    });
  });

  describe("Input validation", () => {
    it("should reject missing clubId", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            boxerId: mockBoxerId,
            updates: { firstName: "Jane" },
          },
          context
        )
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject missing boxerId", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            updates: { firstName: "Jane" },
          },
          context
        )
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });

    it("should reject missing updates", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: mockBoxerId,
          },
          context
        )
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });
  });

  describe("DOB conversion", () => {
    it("should convert dob string to Timestamp", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await callUpdateBoxer(
        {
          clubId: mockClubId,
          boxerId: mockBoxerId,
          updates: { dob: "1995-06-15" },
        },
        context
      );

      expect(mockTimestamp.fromDate).toHaveBeenCalled();
      expect(updatedBoxerData).toHaveProperty("dob");
    });

    it("should reject invalid dob string", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callUpdateBoxer(
          {
            clubId: mockClubId,
            boxerId: mockBoxerId,
            updates: { dob: "not-a-date" },
          },
          context
        )
      ).rejects.toMatchObject({
        code: "invalid-argument",
        message: expect.stringContaining("dob"),
      });
    });
  });

  describe("Various field updates", () => {
    it("should update numeric fields correctly", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await callUpdateBoxer(
        {
          clubId: mockClubId,
          boxerId: mockBoxerId,
          updates: {
            declaredWeight: 80,
            declaredBouts: 15,
            declaredWins: 10,
            declaredLosses: 5,
          },
        },
        context
      );

      expect(updatedBoxerData).toHaveProperty("declaredWeight", 80);
      expect(updatedBoxerData).toHaveProperty("declaredBouts", 15);
      expect(updatedBoxerData).toHaveProperty("declaredWins", 10);
      expect(updatedBoxerData).toHaveProperty("declaredLosses", 5);
    });

    it("should update notes to null", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await callUpdateBoxer(
        {
          clubId: mockClubId,
          boxerId: mockBoxerId,
          updates: { notes: null },
        },
        context
      );

      expect(updatedBoxerData).toHaveProperty("notes", null);
    });

    it("should update notes to a string", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await callUpdateBoxer(
        {
          clubId: mockClubId,
          boxerId: mockBoxerId,
          updates: { notes: "Some notes about the boxer" },
        },
        context
      );

      expect(updatedBoxerData).toHaveProperty(
        "notes",
        "Some notes about the boxer"
      );
    });
  });
});
