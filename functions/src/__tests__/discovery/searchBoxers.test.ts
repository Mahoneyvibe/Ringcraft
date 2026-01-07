/**
 * Unit Tests for searchBoxers Cloud Function
 *
 * Story 5.1: Browse Other Clubs' Boxers
 *
 * Tests the callable function that searches boxers across clubs.
 */

// Mock data
const mockUserId = "test-user-xyz";
const mockClubIdA = "club-a";
const mockClubIdB = "club-b";
const mockClubIdC = "club-c";

// Track boxer data
const mockBoxers: Record<
  string,
  {
    data: Record<string, unknown>;
    clubId: string;
    path: string;
  }
> = {};

// Mock club membership
let userClubMemberships: string[] = [mockClubIdA];

// Mock clubs
const mockClubs: Record<string, { name: string }> = {
  [mockClubIdA]: { name: "Club Alpha" },
  [mockClubIdB]: { name: "Club Beta" },
  [mockClubIdC]: { name: "Club Charlie" },
};

// Helper to create mock boxer
function createMockBoxer(
  id: string,
  clubId: string,
  overrides: Partial<Record<string, unknown>> = {}
) {
  const dob = new Date("2000-01-15");
  return {
    boxerId: id,
    firstName: "Test",
    lastName: "Boxer",
    dob: { toDate: () => dob },
    gender: "male",
    category: "elite",
    declaredWeight: 75,
    declaredBouts: 10,
    declaredWins: 7,
    declaredLosses: 3,
    dataStatus: "active",
    availability: "available",
    notes: "Private notes about boxer",
    createdAt: { toDate: () => new Date() },
    updatedAt: { toDate: () => new Date() },
    createdBy: "some-user",
    lastModifiedBy: "some-user",
    ...overrides,
  };
}

// Mock parent ref for boxer docs
function createMockParentRef(clubId: string) {
  return {
    parent: {
      id: clubId,
    },
  };
}

// Mock Timestamp
const mockTimestampInstance = { toDate: () => new Date() };
const mockTimestamp = {
  now: jest.fn().mockReturnValue(mockTimestampInstance),
  fromDate: jest.fn().mockReturnValue(mockTimestampInstance),
};

// Mock collection group query
const mockCollectionGroupQuery = {
  where: jest.fn().mockReturnThis(),
  get: jest.fn(),
};

// Mock Firestore
const mockFirestore = {
  collectionGroup: jest.fn().mockReturnValue(mockCollectionGroupQuery),
  collection: jest.fn().mockImplementation((path) => {
    if (path === "clubs") {
      return {
        doc: jest.fn().mockImplementation((clubId) => ({
          get: jest.fn().mockResolvedValue({
            exists: !!mockClubs[clubId],
            id: clubId,
            data: () => mockClubs[clubId],
          }),
        })),
      };
    }
    return { doc: jest.fn() };
  }),
  getAll: jest.fn().mockImplementation((...refs) => {
    return Promise.resolve(
      refs.map((ref: { id: string }) => ({
        exists: !!mockClubs[ref.id],
        id: ref.id,
        data: () => mockClubs[ref.id],
      }))
    );
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
      constructor(
        public code: string,
        public message: string
      ) {
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
import { searchBoxers } from "../../discovery/searchBoxers";

// Type assertion for the mocked callable function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callSearchBoxers = searchBoxers as any;

describe("searchBoxers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userClubMemberships = [mockClubIdA];

    // Reset boxers
    Object.keys(mockBoxers).forEach((key) => delete mockBoxers[key]);

    // Setup default boxers in other clubs
    mockBoxers["boxer-b1"] = {
      data: createMockBoxer("boxer-b1", mockClubIdB),
      clubId: mockClubIdB,
      path: `clubs/${mockClubIdB}/boxers/boxer-b1`,
    };
    mockBoxers["boxer-b2"] = {
      data: createMockBoxer("boxer-b2", mockClubIdB, {
        firstName: "Jane",
        gender: "female",
      }),
      clubId: mockClubIdB,
      path: `clubs/${mockClubIdB}/boxers/boxer-b2`,
    };
    mockBoxers["boxer-c1"] = {
      data: createMockBoxer("boxer-c1", mockClubIdC, { category: "youth" }),
      clubId: mockClubIdC,
      path: `clubs/${mockClubIdC}/boxers/boxer-c1`,
    };

    // Mock collectionGroup membership query
    mockFirestore.collectionGroup.mockImplementation((collection: string) => {
      if (collection === "members") {
        return {
          where: jest.fn().mockReturnValue({
            get: jest.fn().mockResolvedValue({
              empty: userClubMemberships.length === 0,
              docs: userClubMemberships.map((clubId) => ({
                ref: {
                  parent: {
                    parent: { id: clubId },
                  },
                },
                data: () => ({ userId: mockUserId, role: "member" }),
              })),
            }),
          }),
        };
      }
      if (collection === "boxers") {
        return mockCollectionGroupQuery;
      }
      return { where: jest.fn().mockReturnThis(), get: jest.fn() };
    });

    // Default boxer query result
    mockCollectionGroupQuery.where.mockReturnThis();
    mockCollectionGroupQuery.get.mockResolvedValue({
      docs: Object.values(mockBoxers).map((b) => ({
        ref: {
          parent: createMockParentRef(b.clubId),
        },
        data: () => b.data,
      })),
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.1: Unauthenticated user cannot search boxers
  // ═══════════════════════════════════════════
  describe("Test 3.1: Unauthenticated user cannot search boxers", () => {
    it("should reject unauthenticated calls", async () => {
      const context = { auth: null };

      await expect(callSearchBoxers({}, context)).rejects.toMatchObject({
        code: "unauthenticated",
      });
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.2: User not in any club cannot search boxers
  // ═══════════════════════════════════════════
  describe("Test 3.2: User not in any club cannot search boxers", () => {
    it("should reject users not in any club", async () => {
      userClubMemberships = []; // No club memberships

      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(callSearchBoxers({}, context)).rejects.toMatchObject({
        code: "permission-denied",
        message: expect.stringContaining("member of at least one club"),
      });
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.3: Valid request returns boxers from other clubs
  // ═══════════════════════════════════════════
  describe("Test 3.3: Valid request returns boxers from other clubs", () => {
    it("should return boxers from other clubs successfully", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers({}, context);

      expect(result.success).toBe(true);
      expect(result.boxers).toBeInstanceOf(Array);
      expect(result.boxers.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.4: Filter by gender returns only matching boxers
  // ═══════════════════════════════════════════
  describe("Test 3.4: Filter by gender returns only matching boxers", () => {
    it("should filter by gender", async () => {
      // Setup boxers with different genders
      mockBoxers["boxer-female"] = {
        data: createMockBoxer("boxer-female", mockClubIdB, { gender: "female" }),
        clubId: mockClubIdB,
        path: `clubs/${mockClubIdB}/boxers/boxer-female`,
      };

      mockCollectionGroupQuery.get.mockResolvedValue({
        docs: Object.values(mockBoxers)
          .filter((b) => (b.data as { gender: string }).gender === "female")
          .map((b) => ({
            ref: { parent: createMockParentRef(b.clubId) },
            data: () => b.data,
          })),
      });

      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers({ gender: "female" }, context);

      expect(result.success).toBe(true);
      // Verify where was called with gender filter
      expect(mockCollectionGroupQuery.where).toHaveBeenCalledWith(
        "gender",
        "==",
        "female"
      );
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.5: Filter by category returns only matching boxers
  // ═══════════════════════════════════════════
  describe("Test 3.5: Filter by category returns only matching boxers", () => {
    it("should filter by category", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await callSearchBoxers({ category: "elite" }, context);

      expect(mockCollectionGroupQuery.where).toHaveBeenCalledWith(
        "category",
        "==",
        "elite"
      );
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.6: Filter by weight range returns only matching boxers
  // ═══════════════════════════════════════════
  describe("Test 3.6: Filter by weight range returns only matching boxers", () => {
    it("should filter by weight range (in-memory)", async () => {
      // Add boxer with different weights
      mockBoxers["boxer-light"] = {
        data: createMockBoxer("boxer-light", mockClubIdB, { declaredWeight: 60 }),
        clubId: mockClubIdB,
        path: `clubs/${mockClubIdB}/boxers/boxer-light`,
      };
      mockBoxers["boxer-heavy"] = {
        data: createMockBoxer("boxer-heavy", mockClubIdB, { declaredWeight: 90 }),
        clubId: mockClubIdB,
        path: `clubs/${mockClubIdB}/boxers/boxer-heavy`,
      };

      mockCollectionGroupQuery.get.mockResolvedValue({
        docs: Object.values(mockBoxers).map((b) => ({
          ref: { parent: createMockParentRef(b.clubId) },
          data: () => b.data,
        })),
      });

      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers(
        { weightMin: 70, weightMax: 80 },
        context
      );

      expect(result.success).toBe(true);
      // Should only return boxers in weight range 70-80
      result.boxers.forEach(
        (boxer: { declaredWeight: number }) => {
          expect(boxer.declaredWeight).toBeGreaterThanOrEqual(70);
          expect(boxer.declaredWeight).toBeLessThanOrEqual(80);
        }
      );
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.7: Filter by availability returns only matching boxers
  // ═══════════════════════════════════════════
  describe("Test 3.7: Filter by availability returns only matching boxers", () => {
    it("should filter by availability", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await callSearchBoxers({ availability: "available" }, context);

      expect(mockCollectionGroupQuery.where).toHaveBeenCalledWith(
        "availability",
        "==",
        "available"
      );
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.8: Only active boxers are returned (no draft/archived)
  // ═══════════════════════════════════════════
  describe("Test 3.8: Only active boxers are returned (no draft/archived)", () => {
    it("should only query active boxers", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await callSearchBoxers({}, context);

      expect(mockCollectionGroupQuery.where).toHaveBeenCalledWith(
        "dataStatus",
        "==",
        "active"
      );
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.9: Notes field is never included in response
  // ═══════════════════════════════════════════
  describe("Test 3.9: Notes field is never included in response", () => {
    it("should not include notes field in response", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers({}, context);

      expect(result.success).toBe(true);
      result.boxers.forEach((boxer: Record<string, unknown>) => {
        expect(boxer).not.toHaveProperty("notes");
      });
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.10: Age is computed correctly from DOB
  // ═══════════════════════════════════════════
  describe("Test 3.10: Age is computed correctly from DOB", () => {
    it("should compute age from DOB", async () => {
      // Set up a boxer with known DOB
      const knownDob = new Date("2000-01-15");
      mockBoxers["boxer-age-test"] = {
        data: {
          ...createMockBoxer("boxer-age-test", mockClubIdB),
          dob: { toDate: () => knownDob },
        },
        clubId: mockClubIdB,
        path: `clubs/${mockClubIdB}/boxers/boxer-age-test`,
      };

      mockCollectionGroupQuery.get.mockResolvedValue({
        docs: [
          {
            ref: { parent: createMockParentRef(mockClubIdB) },
            data: () => mockBoxers["boxer-age-test"].data,
          },
        ],
      });

      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers({}, context);

      expect(result.success).toBe(true);
      expect(result.boxers.length).toBe(1);
      expect(result.boxers[0]).toHaveProperty("age");
      expect(typeof result.boxers[0].age).toBe("number");

      // Calculate expected age
      const today = new Date();
      let expectedAge = today.getFullYear() - knownDob.getFullYear();
      const monthDiff = today.getMonth() - knownDob.getMonth();
      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < knownDob.getDate())
      ) {
        expectedAge--;
      }
      expect(result.boxers[0].age).toBe(expectedAge);
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.11: Club name is included in response
  // ═══════════════════════════════════════════
  describe("Test 3.11: Club name is included in response", () => {
    it("should include club name in response", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers({}, context);

      expect(result.success).toBe(true);
      result.boxers.forEach((boxer: { clubId: string; clubName: string }) => {
        expect(boxer).toHaveProperty("clubId");
        expect(boxer).toHaveProperty("clubName");
        expect(typeof boxer.clubName).toBe("string");
      });
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.12: Own club boxers excluded when flag is true
  // ═══════════════════════════════════════════
  describe("Test 3.12: Own club boxers excluded when flag is true", () => {
    it("should exclude own club boxers when excludeOwnClub is true", async () => {
      // Add a boxer to user's own club
      mockBoxers["boxer-own"] = {
        data: createMockBoxer("boxer-own", mockClubIdA),
        clubId: mockClubIdA, // User's club
        path: `clubs/${mockClubIdA}/boxers/boxer-own`,
      };

      mockCollectionGroupQuery.get.mockResolvedValue({
        docs: Object.values(mockBoxers).map((b) => ({
          ref: { parent: createMockParentRef(b.clubId) },
          data: () => b.data,
        })),
      });

      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers({ excludeOwnClub: true }, context);

      expect(result.success).toBe(true);
      // Should not include boxers from user's club
      result.boxers.forEach((boxer: { clubId: string }) => {
        expect(boxer.clubId).not.toBe(mockClubIdA);
      });
    });

    it("should exclude own club boxers by default", async () => {
      mockBoxers["boxer-own"] = {
        data: createMockBoxer("boxer-own", mockClubIdA),
        clubId: mockClubIdA,
        path: `clubs/${mockClubIdA}/boxers/boxer-own`,
      };

      mockCollectionGroupQuery.get.mockResolvedValue({
        docs: Object.values(mockBoxers).map((b) => ({
          ref: { parent: createMockParentRef(b.clubId) },
          data: () => b.data,
        })),
      });

      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      // No excludeOwnClub param - should default to true
      const result = await callSearchBoxers({}, context);

      expect(result.success).toBe(true);
      result.boxers.forEach((boxer: { clubId: string }) => {
        expect(boxer.clubId).not.toBe(mockClubIdA);
      });
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.13: Own club boxers included when flag is false
  // ═══════════════════════════════════════════
  describe("Test 3.13: Own club boxers included when flag is false", () => {
    it("should include own club boxers when excludeOwnClub is false", async () => {
      mockBoxers["boxer-own"] = {
        data: createMockBoxer("boxer-own", mockClubIdA),
        clubId: mockClubIdA,
        path: `clubs/${mockClubIdA}/boxers/boxer-own`,
      };

      mockCollectionGroupQuery.get.mockResolvedValue({
        docs: Object.values(mockBoxers).map((b) => ({
          ref: { parent: createMockParentRef(b.clubId) },
          data: () => b.data,
        })),
      });

      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers({ excludeOwnClub: false }, context);

      expect(result.success).toBe(true);
      // Should include the own club boxer
      const ownClubBoxers = result.boxers.filter(
        (b: { clubId: string }) => b.clubId === mockClubIdA
      );
      expect(ownClubBoxers.length).toBeGreaterThan(0);
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.14: Pagination works correctly (limit/offset)
  // ═══════════════════════════════════════════
  describe("Test 3.14: Pagination works correctly (limit/offset)", () => {
    it("should respect limit parameter", async () => {
      // Add many boxers
      for (let i = 0; i < 10; i++) {
        mockBoxers[`boxer-page-${i}`] = {
          data: createMockBoxer(`boxer-page-${i}`, mockClubIdB),
          clubId: mockClubIdB,
          path: `clubs/${mockClubIdB}/boxers/boxer-page-${i}`,
        };
      }

      mockCollectionGroupQuery.get.mockResolvedValue({
        docs: Object.values(mockBoxers).map((b) => ({
          ref: { parent: createMockParentRef(b.clubId) },
          data: () => b.data,
        })),
      });

      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers({ limit: 3 }, context);

      expect(result.success).toBe(true);
      expect(result.boxers.length).toBe(3);
      expect(result.total).toBeGreaterThan(3);
      expect(result.hasMore).toBe(true);
    });

    it("should respect offset parameter", async () => {
      // Add boxers with distinct IDs
      for (let i = 0; i < 5; i++) {
        mockBoxers[`boxer-offset-${i}`] = {
          data: createMockBoxer(`boxer-offset-${i}`, mockClubIdB),
          clubId: mockClubIdB,
          path: `clubs/${mockClubIdB}/boxers/boxer-offset-${i}`,
        };
      }

      mockCollectionGroupQuery.get.mockResolvedValue({
        docs: Object.values(mockBoxers).map((b) => ({
          ref: { parent: createMockParentRef(b.clubId) },
          data: () => b.data,
        })),
      });

      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const resultPage1 = await callSearchBoxers({ limit: 2, offset: 0 }, context);
      const resultPage2 = await callSearchBoxers({ limit: 2, offset: 2 }, context);

      expect(resultPage1.boxers.length).toBe(2);
      expect(resultPage2.boxers.length).toBe(2);
      // Pages should have different boxers
      expect(resultPage1.boxers[0].boxerId).not.toBe(resultPage2.boxers[0].boxerId);
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.15: Empty results return empty array (not error)
  // ═══════════════════════════════════════════
  describe("Test 3.15: Empty results return empty array (not error)", () => {
    it("should return empty array when no boxers match", async () => {
      mockCollectionGroupQuery.get.mockResolvedValue({
        docs: [],
      });

      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers({}, context);

      expect(result.success).toBe(true);
      expect(result.boxers).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.hasMore).toBe(false);
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.16: Multiple filters combine correctly (AND logic)
  // ═══════════════════════════════════════════
  describe("Test 3.16: Multiple filters combine correctly (AND logic)", () => {
    it("should combine multiple filters with AND logic", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await callSearchBoxers(
        {
          gender: "male",
          category: "elite",
          availability: "available",
        },
        context
      );

      // Verify all filters were applied
      expect(mockCollectionGroupQuery.where).toHaveBeenCalledWith(
        "dataStatus",
        "==",
        "active"
      );
      expect(mockCollectionGroupQuery.where).toHaveBeenCalledWith(
        "gender",
        "==",
        "male"
      );
      expect(mockCollectionGroupQuery.where).toHaveBeenCalledWith(
        "category",
        "==",
        "elite"
      );
      expect(mockCollectionGroupQuery.where).toHaveBeenCalledWith(
        "availability",
        "==",
        "available"
      );
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.17: User in multiple clubs - all excluded when flag true
  // ═══════════════════════════════════════════
  describe("Test 3.17: User in multiple clubs - all excluded when flag true", () => {
    it("should exclude all user clubs when user is in multiple clubs", async () => {
      // User is in clubs A and B
      userClubMemberships = [mockClubIdA, mockClubIdB];

      // Add boxers to all clubs
      mockBoxers["boxer-a"] = {
        data: createMockBoxer("boxer-a", mockClubIdA),
        clubId: mockClubIdA,
        path: `clubs/${mockClubIdA}/boxers/boxer-a`,
      };
      mockBoxers["boxer-b"] = {
        data: createMockBoxer("boxer-b", mockClubIdB),
        clubId: mockClubIdB,
        path: `clubs/${mockClubIdB}/boxers/boxer-b`,
      };
      mockBoxers["boxer-c"] = {
        data: createMockBoxer("boxer-c", mockClubIdC),
        clubId: mockClubIdC,
        path: `clubs/${mockClubIdC}/boxers/boxer-c`,
      };

      mockCollectionGroupQuery.get.mockResolvedValue({
        docs: Object.values(mockBoxers).map((b) => ({
          ref: { parent: createMockParentRef(b.clubId) },
          data: () => b.data,
        })),
      });

      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers({ excludeOwnClub: true }, context);

      expect(result.success).toBe(true);
      // Should only have boxers from club C
      result.boxers.forEach((boxer: { clubId: string }) => {
        expect(boxer.clubId).not.toBe(mockClubIdA);
        expect(boxer.clubId).not.toBe(mockClubIdB);
      });
      expect(result.boxers.some((b: { clubId: string }) => b.clubId === mockClubIdC)).toBe(
        true
      );
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.18: Invalid weight range (negative) returns error
  // ═══════════════════════════════════════════
  describe("Test 3.18: Invalid weight range (negative) returns error", () => {
    it("should reject negative weightMin", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callSearchBoxers({ weightMin: -10 }, context)
      ).rejects.toMatchObject({
        code: "invalid-argument",
        message: expect.stringContaining("weightMin"),
      });
    });

    it("should reject negative weightMax", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      await expect(
        callSearchBoxers({ weightMax: -5 }, context)
      ).rejects.toMatchObject({
        code: "invalid-argument",
        message: expect.stringContaining("weightMax"),
      });
    });
  });

  // ═══════════════════════════════════════════
  // Test 3.19: Limit exceeds max (>100) capped to 100
  // ═══════════════════════════════════════════
  describe("Test 3.19: Limit exceeds max (>100) capped to 100", () => {
    it("should cap limit to 100", async () => {
      // Add many boxers
      for (let i = 0; i < 150; i++) {
        mockBoxers[`boxer-cap-${i}`] = {
          data: createMockBoxer(`boxer-cap-${i}`, mockClubIdB),
          clubId: mockClubIdB,
          path: `clubs/${mockClubIdB}/boxers/boxer-cap-${i}`,
        };
      }

      mockCollectionGroupQuery.get.mockResolvedValue({
        docs: Object.values(mockBoxers).map((b) => ({
          ref: { parent: createMockParentRef(b.clubId) },
          data: () => b.data,
        })),
      });

      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers({ limit: 200 }, context);

      expect(result.success).toBe(true);
      expect(result.boxers.length).toBeLessThanOrEqual(100);
      expect(result.total).toBeGreaterThan(100);
      expect(result.hasMore).toBe(true);
    });
  });

  // Additional tests for response structure
  describe("Response structure validation", () => {
    it("should return proper response structure", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers({}, context);

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("boxers");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("hasMore");
    });

    it("should not include internal fields in boxer response", async () => {
      const context = {
        auth: { uid: mockUserId, token: {} },
      };

      const result = await callSearchBoxers({}, context);

      result.boxers.forEach((boxer: Record<string, unknown>) => {
        expect(boxer).not.toHaveProperty("createdAt");
        expect(boxer).not.toHaveProperty("updatedAt");
        expect(boxer).not.toHaveProperty("createdBy");
        expect(boxer).not.toHaveProperty("lastModifiedBy");
        expect(boxer).not.toHaveProperty("dataStatus");
      });
    });
  });
});
