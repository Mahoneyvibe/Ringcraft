/**
 * Unit Tests for searchClubs Cloud Function
 *
 * Story 2.1: Pre-Seeded Club Directory
 *
 * These tests use mocks to run offline without the Firebase emulator.
 */

// Mock club data
const mockClubs = [
  {
    clubId: "repton-abc",
    name: "Repton Amateur Boxing Club",
    region: "London",
    status: "unclaimed",
    claimedBy: null,
    claimedAt: null,
    contactEmail: "repton@example.com",
    contactPhone: "+44123456789", // Should NOT be returned
  },
  {
    clubId: "dale-youth-abc",
    name: "Dale Youth Amateur Boxing Club",
    region: "London",
    status: "unclaimed",
    claimedBy: null,
    claimedAt: null,
    contactEmail: null,
    contactPhone: "+44987654321", // Should NOT be returned
  },
  {
    clubId: "sheffield-city-abc",
    name: "Sheffield City Amateur Boxing Club",
    region: "Yorkshire",
    status: "unclaimed",
    claimedBy: null,
    claimedAt: null,
    contactEmail: null,
    contactPhone: null,
  },
];

// Mock Firestore query
const mockGet = jest.fn().mockResolvedValue({
  docs: mockClubs.map((club) => ({
    data: () => club,
  })),
});
const mockWhere = jest.fn().mockReturnValue({ get: mockGet });
const mockCollection = jest.fn().mockReturnValue({
  get: mockGet,
  where: mockWhere,
});

// Mock firebase-admin before importing the function
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: jest.fn(() => ({
    collection: mockCollection,
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
import { searchClubs } from "../../clubs/searchClubs";

// Type assertion for the mocked callable function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callSearchClubs = searchClubs as any;

describe("searchClubs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock to return all clubs
    mockGet.mockResolvedValue({
      docs: mockClubs.map((club) => ({
        data: () => club,
      })),
    });
    mockWhere.mockReturnValue({ get: mockGet });
  });

  describe("Authentication (AC: 2)", () => {
    it("should reject unauthenticated calls", async () => {
      const context = { auth: null };

      await expect(callSearchClubs({}, context)).rejects.toMatchObject({
        code: "unauthenticated",
      });
    });

    it("should accept authenticated calls", async () => {
      const context = {
        auth: {
          uid: "authenticated-user",
          token: {},
        },
      };

      const result = await callSearchClubs({}, context);

      expect(result).toHaveProperty("clubs");
      expect(result).toHaveProperty("total");
    });
  });

  describe("Search by name (AC: 2)", () => {
    it("should return matching clubs by name (case-insensitive)", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callSearchClubs({ query: "repton" }, context);

      expect(result.clubs).toHaveLength(1);
      expect(result.clubs[0].name).toBe("Repton Amateur Boxing Club");
      expect(result.total).toBe(1);
    });

    it("should return multiple matches for partial name", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callSearchClubs({ query: "Amateur" }, context);

      expect(result.clubs).toHaveLength(3);
      expect(result.total).toBe(3);
    });

    it("should return empty results for no matches", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callSearchClubs({ query: "nonexistent" }, context);

      expect(result.clubs).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("Filter by region (AC: 2)", () => {
    it("should filter by region", async () => {
      // Setup mock to return filtered result when where is called
      const londonClubs = mockClubs.filter((c) => c.region === "London");
      mockWhere.mockReturnValue({
        get: jest.fn().mockResolvedValue({
          docs: londonClubs.map((club) => ({
            data: () => club,
          })),
        }),
      });

      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callSearchClubs({ region: "London" }, context);

      expect(mockWhere).toHaveBeenCalledWith("region", "==", "London");
      expect(result.clubs).toHaveLength(2);
      expect(result.clubs.every((c: { region: string }) => c.region === "London")).toBe(true);
    });

    it("should combine name and region filters", async () => {
      const londonClubs = mockClubs.filter((c) => c.region === "London");
      mockWhere.mockReturnValue({
        get: jest.fn().mockResolvedValue({
          docs: londonClubs.map((club) => ({
            data: () => club,
          })),
        }),
      });

      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callSearchClubs(
        { query: "Repton", region: "London" },
        context
      );

      expect(result.clubs).toHaveLength(1);
      expect(result.clubs[0].name).toBe("Repton Amateur Boxing Club");
    });
  });

  describe("Data privacy - contactPhone exclusion (AC: 2)", () => {
    it("should NOT include contactPhone in results", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callSearchClubs({}, context);

      // Verify contactPhone is never returned
      result.clubs.forEach((club: Record<string, unknown>) => {
        expect(club).not.toHaveProperty("contactPhone");
        expect(club).toHaveProperty("clubId");
        expect(club).toHaveProperty("name");
        expect(club).toHaveProperty("region");
        expect(club).toHaveProperty("status");
      });
    });

    it("should NOT include contactEmail in results", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callSearchClubs({}, context);

      // Verify contactEmail is not returned
      result.clubs.forEach((club: Record<string, unknown>) => {
        expect(club).not.toHaveProperty("contactEmail");
      });
    });

    it("should only return public fields", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callSearchClubs({}, context);

      // Each club should only have these public fields
      result.clubs.forEach((club: Record<string, unknown>) => {
        const keys = Object.keys(club);
        expect(keys).toEqual(
          expect.arrayContaining(["clubId", "name", "region", "status"])
        );
        expect(keys).toHaveLength(4);
      });
    });
  });

  describe("Empty/null search parameters", () => {
    it("should return all clubs when no filters provided", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callSearchClubs({}, context);

      expect(result.clubs).toHaveLength(3);
    });

    it("should handle null data gracefully", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callSearchClubs(null, context);

      expect(result.clubs).toHaveLength(3);
    });

    it("should handle undefined data gracefully", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callSearchClubs(undefined, context);

      expect(result.clubs).toHaveLength(3);
    });

    it("should handle empty string query", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callSearchClubs({ query: "" }, context);

      expect(result.clubs).toHaveLength(3);
    });

    it("should handle whitespace-only query", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callSearchClubs({ query: "   " }, context);

      expect(result.clubs).toHaveLength(3);
    });
  });
});
