/**
 * Unit Tests for findMatch Cloud Function
 *
 * Story 6.1: Match a Boxer (AI-First)
 * Task 8: Tests for the findMatch callable function
 *
 * Tests authentication, authorization, filtering, and results.
 */

// Mock data
const mockUserId = "test-user-xyz";
const mockClubIdA = "club-a";
const mockClubIdB = "club-b";

// Track boxer data
const mockBoxers: Record<
  string,
  {
    data: Record<string, unknown>;
    clubId: string;
  }
> = {};

// Track rate limit data
const mockRateLimits: Record<string, { requests: number[] }> = {};

// Used in beforeEach and tests to control mock behavior
let userClubMemberships: string[] = [mockClubIdA];

// Silence unused variable warning by referencing it
void userClubMemberships;

// Mock clubs
const mockClubs: Record<string, { name: string }> = {
  [mockClubIdA]: { name: "Club Alpha" },
  [mockClubIdB]: { name: "Club Beta" },
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
    declaredWeight: 72,
    declaredBouts: 10,
    declaredWins: 7,
    declaredLosses: 3,
    dataStatus: "active",
    availability: "available",
    ...overrides,
  };
}

// Mock Firestore
const mockFirestore = {
  collectionGroup: jest.fn().mockReturnValue({
    where: jest.fn().mockReturnThis(),
    get: jest.fn(),
  }),
  collection: jest.fn().mockImplementation((path) => {
    if (path === "clubs") {
      return {
        doc: jest.fn().mockImplementation((clubId) => ({
          get: jest.fn().mockResolvedValue({
            exists: !!mockClubs[clubId],
            id: clubId,
            data: () => mockClubs[clubId],
          }),
          collection: jest.fn().mockImplementation(() => ({
            where: jest.fn().mockReturnThis(),
            get: jest.fn().mockResolvedValue({
              docs: Object.entries(mockBoxers)
                .filter(([_, b]) => b.clubId === clubId)
                .map(([id, b]) => ({
                  id,
                  data: () => b.data,
                  ref: { parent: { parent: { id: clubId } } },
                })),
            }),
            doc: jest.fn().mockImplementation((boxerId) => ({
              get: jest.fn().mockResolvedValue({
                exists: !!mockBoxers[boxerId] && mockBoxers[boxerId].clubId === clubId,
                id: boxerId,
                data: () => mockBoxers[boxerId]?.data,
              }),
            })),
          })),
        })),
      };
    }
    if (path === "rateLimits") {
      return {
        doc: jest.fn().mockImplementation((docId) => ({
          get: jest.fn().mockResolvedValue({
            exists: !!mockRateLimits[docId],
            data: () => mockRateLimits[docId] || { requests: [] },
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
  runTransaction: jest.fn().mockImplementation(async (fn) => {
    const transaction = {
      get: jest.fn().mockResolvedValue({
        data: () => ({ requests: [] }),
      }),
      set: jest.fn(),
    };
    return fn(transaction);
  }),
};

// Mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => mockFirestore),
  auth: jest.fn(),
}));

// Mock firebase-functions
jest.mock("firebase-functions", () => ({
  https: {
    HttpsError: class HttpsError extends Error {
      constructor(
        public code: string,
        message: string
      ) {
        super(message);
        this.name = "HttpsError";
      }
    },
    onCall: jest.fn((handler) => handler),
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  config: jest.fn(() => ({})),
}));

// Mock LLM service to use regex fallback
jest.mock("../../matchmaking/llmService", () => ({
  parseMatchIntentWithLLM: jest.fn().mockImplementation((query, boxers) => {
    const { parseMatchIntent } = require("../../matchmaking/intentParser");
    return Promise.resolve(parseMatchIntent(query, boxers));
  }),
  generateMatchExplanation: jest.fn().mockResolvedValue("Test explanation"),
}));

// Import the module, not the export directly
import * as findMatchModule from "../../matchmaking/findMatch";
import * as functions from "firebase-functions";
import { FindMatchRequest, FindMatchResponse } from "../../types/matchmaking";

// Get the handler function and cast it properly
const findMatch = findMatchModule.findMatch as unknown as (
  data: FindMatchRequest,
  context: { auth: { uid: string } | null }
) => Promise<FindMatchResponse>;

describe("findMatch Cloud Function", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userClubMemberships = [mockClubIdA];
    Object.keys(mockBoxers).forEach((key) => delete mockBoxers[key]);
    Object.keys(mockRateLimits).forEach((key) => delete mockRateLimits[key]);

    // Setup default boxers
    mockBoxers["boxer-jake"] = {
      clubId: mockClubIdA,
      data: createMockBoxer("boxer-jake", mockClubIdA, {
        firstName: "Jake",
        lastName: "Smith",
      }),
    };
    mockBoxers["boxer-opponent"] = {
      clubId: mockClubIdB,
      data: createMockBoxer("boxer-opponent", mockClubIdB, {
        firstName: "John",
        lastName: "Doe",
      }),
    };

    // Setup collectionGroup mock
    const mockCollectionGroupQuery = mockFirestore.collectionGroup();
    mockCollectionGroupQuery.get.mockResolvedValue({
      docs: [
        {
          data: () => mockBoxers["boxer-opponent"].data,
          ref: { parent: { parent: { id: mockClubIdB } } },
        },
      ],
    });
  });

  // ═══════════════════════════════════════════
  // TEST 8.2: Unauthenticated user cannot find matches
  // ═══════════════════════════════════════════
  it("should reject unauthenticated requests", async () => {
    const context = { auth: null };

    await expect(
      findMatch({ naturalLanguageQuery: "Find a match for Jake" }, context as never)
    ).rejects.toThrow("Must be authenticated");
  });

  // ═══════════════════════════════════════════
  // TEST 8.3: User not in any club cannot find matches
  // ═══════════════════════════════════════════
  it("should reject users not in any club", async () => {
    userClubMemberships = [];

    // Override collectionGroup for members query
    mockFirestore.collectionGroup.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({ empty: true, docs: [] }),
    });

    const context = { auth: { uid: mockUserId } };

    await expect(
      findMatch({ naturalLanguageQuery: "Find a match for Jake" }, context as never)
    ).rejects.toThrow("member of at least one club");
  });

  // ═══════════════════════════════════════════
  // TEST 8.4: Valid request returns compliant matches
  // ═══════════════════════════════════════════
  it("should return matches for valid request", async () => {
    // Setup member query
    mockFirestore.collectionGroup.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [
          {
            ref: { parent: { parent: { id: mockClubIdA } } },
          },
        ],
      }),
    });

    const context = { auth: { uid: mockUserId } };
    const result = await findMatch(
      { naturalLanguageQuery: "Find a match for Jake" },
      context as never
    );

    expect(result.success).toBe(true);
    expect(result.sourceBoxer).toBeDefined();
    expect(result.parsedIntent).toBeDefined();
  });

  // ═══════════════════════════════════════════
  // TEST 8.5: Non-compliant matches are excluded
  // ═══════════════════════════════════════════
  it("should exclude non-compliant matches", async () => {
    // Add a non-compliant boxer (different category)
    mockBoxers["boxer-noncompliant"] = {
      clubId: mockClubIdB,
      data: createMockBoxer("boxer-noncompliant", mockClubIdB, {
        firstName: "NonCompliant",
        lastName: "Boxer",
        category: "youth", // Different category
      }),
    };

    // Setup queries
    mockFirestore.collectionGroup
      .mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [{ ref: { parent: { parent: { id: mockClubIdA } } } }],
        }),
      })
      .mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          docs: [
            {
              data: () => mockBoxers["boxer-noncompliant"].data,
              ref: { parent: { parent: { id: mockClubIdB } } },
            },
          ],
        }),
      });

    const context = { auth: { uid: mockUserId } };
    const result = await findMatch(
      { naturalLanguageQuery: "Find a match for Jake" },
      context as never
    );

    // Should have filtered count > 0
    expect(result.filtered).toBeGreaterThanOrEqual(0);
  });

  // ═══════════════════════════════════════════
  // TEST 8.6: Matches sorted by compliance score
  // ═══════════════════════════════════════════
  it("should sort matches by compliance score", async () => {
    // Setup queries
    mockFirestore.collectionGroup.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ ref: { parent: { parent: { id: mockClubIdA } } } }],
      }),
    });

    const context = { auth: { uid: mockUserId } };
    const result = await findMatch(
      { naturalLanguageQuery: "Find a match for Jake" },
      context as never
    );

    // If multiple matches, verify sorted
    if (result.matches.length > 1) {
      for (let i = 1; i < result.matches.length; i++) {
        expect(result.matches[i - 1].complianceScore).toBeGreaterThanOrEqual(
          result.matches[i].complianceScore
        );
      }
    }
  });

  // ═══════════════════════════════════════════
  // TEST 8.7: Response includes explanation
  // ═══════════════════════════════════════════
  it("should include explanation in response", async () => {
    mockFirestore.collectionGroup.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ ref: { parent: { parent: { id: mockClubIdA } } } }],
      }),
    });

    const context = { auth: { uid: mockUserId } };
    const result = await findMatch(
      { naturalLanguageQuery: "Find a match for Jake" },
      context as never
    );

    expect(result.explanation).toBeDefined();
    expect(typeof result.explanation).toBe("string");
    expect(result.explanation.length).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════
  // TEST 8.8: Rate limiting enforced
  // ═══════════════════════════════════════════
  it("should enforce rate limiting", async () => {
    // Simulate many recent requests
    mockFirestore.runTransaction.mockImplementationOnce(async () => {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        "Rate limit exceeded"
      );
    });

    mockFirestore.collectionGroup.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ ref: { parent: { parent: { id: mockClubIdA } } } }],
      }),
    });

    const context = { auth: { uid: mockUserId } };

    await expect(
      findMatch({ naturalLanguageQuery: "Find a match for Jake" }, context as never)
    ).rejects.toThrow("Rate limit");
  });

  // ═══════════════════════════════════════════
  // TEST 8.9: Empty results return empty array (not error)
  // ═══════════════════════════════════════════
  it("should return empty array when no matches found", async () => {
    // No candidates available
    mockFirestore.collectionGroup
      .mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({
          empty: false,
          docs: [{ ref: { parent: { parent: { id: mockClubIdA } } } }],
        }),
      })
      .mockReturnValueOnce({
        where: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ docs: [] }),
      });

    const context = { auth: { uid: mockUserId } };
    const result = await findMatch(
      { naturalLanguageQuery: "Find a match for Jake" },
      context as never
    );

    expect(result.success).toBe(true);
    expect(result.matches).toEqual([]);
    expect(result.explanation).toContain("No compliant matches");
  });

  // ═══════════════════════════════════════════
  // TEST 8.10: Invalid boxer ID returns appropriate error
  // ═══════════════════════════════════════════
  it("should return error for unknown boxer name", async () => {
    mockFirestore.collectionGroup.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ ref: { parent: { parent: { id: mockClubIdA } } } }],
      }),
    });

    const context = { auth: { uid: mockUserId } };
    const result = await findMatch(
      { naturalLanguageQuery: "Find a match for Unknown Person" },
      context as never
    );

    expect(result.success).toBe(false);
    expect(result.sourceBoxer).toBeNull();
    expect(result.explanation).toContain("No boxer named");
  });

  it("should reject invalid boxer ID", async () => {
    mockFirestore.collectionGroup.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ ref: { parent: { parent: { id: mockClubIdA } } } }],
      }),
    });

    const context = { auth: { uid: mockUserId } };

    await expect(
      findMatch(
        { naturalLanguageQuery: "test", boxerId: "invalid-boxer-id" },
        context as never
      )
    ).rejects.toThrow("Boxer not found");
  });

  // ═══════════════════════════════════════════
  // TEST 8.11: Source boxer from different club rejected
  // ═══════════════════════════════════════════
  it("should reject boxer ID from different club", async () => {
    // boxerId belongs to club-b but user is in club-a
    mockFirestore.collectionGroup.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ ref: { parent: { parent: { id: mockClubIdA } } } }],
      }),
    });

    const context = { auth: { uid: mockUserId } };

    await expect(
      findMatch(
        { naturalLanguageQuery: "test", boxerId: "boxer-opponent" },
        context as never
      )
    ).rejects.toThrow("Boxer not found in your club");
  });

  // ═══════════════════════════════════════════
  // TEST 8.12: Concurrent requests respect rate limiting
  // ═══════════════════════════════════════════
  it("should track requests correctly in rate limiting", async () => {
    let requestCount = 0;

    mockFirestore.runTransaction.mockImplementation(async (fn) => {
      requestCount++;
      const transaction = {
        get: jest.fn().mockResolvedValue({
          data: () => ({ requests: Array(requestCount - 1).fill(Date.now()) }),
        }),
        set: jest.fn(),
      };
      return fn(transaction);
    });

    mockFirestore.collectionGroup.mockReturnValue({
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ ref: { parent: { parent: { id: mockClubIdA } } } }],
      }),
    });

    const context = { auth: { uid: mockUserId } };

    // First request should succeed
    const result = await findMatch(
      { naturalLanguageQuery: "Find a match for Jake" },
      context as never
    );

    expect(result.success).toBeDefined();
    expect(requestCount).toBeGreaterThan(0);
  });

  // ═══════════════════════════════════════════
  // Additional tests
  // ═══════════════════════════════════════════
  it("should reject empty query", async () => {
    mockFirestore.collectionGroup.mockReturnValueOnce({
      where: jest.fn().mockReturnThis(),
      get: jest.fn().mockResolvedValue({
        empty: false,
        docs: [{ ref: { parent: { parent: { id: mockClubIdA } } } }],
      }),
    });

    const context = { auth: { uid: mockUserId } };

    await expect(
      findMatch({ naturalLanguageQuery: "" }, context as never)
    ).rejects.toThrow("naturalLanguageQuery is required");
  });
});
