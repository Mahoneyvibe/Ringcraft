/**
 * Unit Tests for getClubMembers Cloud Function
 *
 * Story 3.2: View Club Members
 *
 * These tests use mocks to run offline without the Firebase emulator.
 */

import { Timestamp } from "firebase-admin/firestore";

// Mock member data
const mockMembers = [
  {
    userId: "user-1",
    displayName: "John Smith",
    photoURL: "https://example.com/photo1.jpg",
    role: "chair",
    joinedAt: { toDate: () => new Date("2026-01-01") } as Timestamp,
    updatedAt: { toDate: () => new Date("2026-01-01") } as Timestamp,
  },
  {
    userId: "user-2",
    displayName: "Jane Doe",
    photoURL: null,
    role: "coach",
    joinedAt: { toDate: () => new Date("2026-01-02") } as Timestamp,
    updatedAt: { toDate: () => new Date("2026-01-02") } as Timestamp,
  },
];

// Mock club data
const mockClub = {
  clubId: "test-club",
  name: "Test Boxing Club",
  region: "London",
  status: "claimed",
};

// Mock Firestore
const mockMembersGet = jest.fn();
const mockClubGet = jest.fn();
const mockMembersCollection = jest.fn().mockReturnValue({ get: mockMembersGet });
const mockClubDoc = jest.fn().mockReturnValue({
  get: mockClubGet,
  collection: mockMembersCollection,
});
const mockCollection = jest.fn().mockReturnValue({
  doc: mockClubDoc,
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
import { getClubMembers } from "../../clubs/getClubMembers";

// Type assertion for the mocked callable function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const callGetClubMembers = getClubMembers as any;

describe("getClubMembers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: club exists and has members
    mockClubGet.mockResolvedValue({
      exists: true,
      data: () => mockClub,
    });
    mockMembersGet.mockResolvedValue({
      docs: mockMembers.map((member) => ({
        data: () => member,
      })),
    });
  });

  describe("Authentication (AC: 2)", () => {
    it("should reject unauthenticated calls", async () => {
      const context = { auth: null };

      await expect(
        callGetClubMembers({ clubId: "test-club" }, context)
      ).rejects.toMatchObject({
        code: "unauthenticated",
      });
    });

    it("should accept any authenticated user", async () => {
      const context = {
        auth: {
          uid: "any-user",
          token: {},
        },
      };

      const result = await callGetClubMembers({ clubId: "test-club" }, context);

      expect(result).toHaveProperty("members");
      expect(result).toHaveProperty("total");
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

      await expect(callGetClubMembers({}, context)).rejects.toMatchObject({
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
        callGetClubMembers({ clubId: "   " }, context)
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
        callGetClubMembers({ clubId: 123 }, context)
      ).rejects.toMatchObject({
        code: "invalid-argument",
      });
    });
  });

  describe("Club existence (AC: 2)", () => {
    it("should return error for non-existent club", async () => {
      mockClubGet.mockResolvedValue({
        exists: false,
      });

      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      await expect(
        callGetClubMembers({ clubId: "non-existent" }, context)
      ).rejects.toMatchObject({
        code: "not-found",
      });
    });
  });

  describe("Member data (AC: 1)", () => {
    it("should return correct member data", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callGetClubMembers({ clubId: "test-club" }, context);

      expect(result.members).toHaveLength(2);
      expect(result.total).toBe(2);

      // Check first member
      expect(result.members[0]).toHaveProperty("userId", "user-1");
      expect(result.members[0]).toHaveProperty("displayName", "John Smith");
      expect(result.members[0]).toHaveProperty(
        "photoURL",
        "https://example.com/photo1.jpg"
      );
      expect(result.members[0]).toHaveProperty("role", "chair");
      expect(result.members[0]).toHaveProperty("joinedAt");

      // Check second member (null photoURL)
      expect(result.members[1]).toHaveProperty("userId", "user-2");
      expect(result.members[1]).toHaveProperty("displayName", "Jane Doe");
      expect(result.members[1]).toHaveProperty("photoURL", null);
      expect(result.members[1]).toHaveProperty("role", "coach");
    });

    it("should NOT include updatedAt in response", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callGetClubMembers({ clubId: "test-club" }, context);

      result.members.forEach((member: Record<string, unknown>) => {
        expect(member).not.toHaveProperty("updatedAt");
      });
    });

    it("should include all required fields", async () => {
      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callGetClubMembers({ clubId: "test-club" }, context);

      result.members.forEach((member: Record<string, unknown>) => {
        expect(member).toHaveProperty("userId");
        expect(member).toHaveProperty("displayName");
        expect(member).toHaveProperty("photoURL");
        expect(member).toHaveProperty("role");
        expect(member).toHaveProperty("joinedAt");
      });
    });
  });

  describe("Empty club", () => {
    it("should return empty array for club with no members", async () => {
      mockMembersGet.mockResolvedValue({
        docs: [],
      });

      const context = {
        auth: {
          uid: "user-123",
          token: {},
        },
      };

      const result = await callGetClubMembers({ clubId: "test-club" }, context);

      expect(result.members).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe("Cross-club access (AC: 2)", () => {
    it("should allow user to view members of any club", async () => {
      // User is not a member of the requested club
      const context = {
        auth: {
          uid: "other-user",
          token: {},
        },
      };

      const result = await callGetClubMembers({ clubId: "test-club" }, context);

      // Should still succeed
      expect(result.members).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });
});
