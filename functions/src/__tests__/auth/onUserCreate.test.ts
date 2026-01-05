/**
 * Tests for onUserCreate Auth Trigger
 *
 * Story 1.1 - User Authentication
 *
 * Uses offline mode with mocks - no emulator required
 */

import functionsTest from "firebase-functions-test";

// Initialize test environment in OFFLINE mode (no emulator)
const testEnv = functionsTest();

// Mock Firestore
const mockSet = jest.fn().mockResolvedValue(undefined);
const mockGet = jest.fn();
const mockDoc = jest.fn().mockReturnValue({
  get: mockGet,
  set: mockSet,
});
const mockCollection = jest.fn().mockReturnValue({
  doc: mockDoc,
});

// Mock Timestamp
const mockTimestamp = { seconds: 1234567890, nanoseconds: 0 };

// Mock firebase-admin
jest.mock("firebase-admin", () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(
    jest.fn(() => ({
      collection: mockCollection,
    })),
    {
      Timestamp: {
        now: jest.fn(() => mockTimestamp),
      },
    }
  ),
}));

// Import after mocking
import { onUserCreate } from "../../auth/onUserCreate";

/**
 * Create a mock UserRecord for testing
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockUserRecord(overrides: Record<string, any> = {}): any {
  return {
    uid: "test-user-" + Math.random().toString(36).substring(7),
    email: "test@example.com",
    emailVerified: false,
    displayName: "Test User",
    photoURL: null,
    phoneNumber: null,
    disabled: false,
    metadata: {
      creationTime: new Date().toISOString(),
      lastSignInTime: new Date().toISOString(),
      toJSON: () => ({}),
    },
    providerData: [],
    toJSON: () => ({}),
    ...overrides,
  };
}

describe("onUserCreate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: doc doesn't exist
    mockGet.mockResolvedValue({ exists: false });
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  it("should create user document with correct schema on auth signup", async () => {
    // Arrange
    const testUser = createMockUserRecord({
      uid: "test-user-123",
      email: "test@example.com",
      displayName: "Test User",
      photoURL: "https://example.com/photo.jpg",
    });

    // Act
    const wrapped = testEnv.wrap(onUserCreate);
    await wrapped(testUser);

    // Assert
    expect(mockCollection).toHaveBeenCalledWith("users");
    expect(mockDoc).toHaveBeenCalledWith("test-user-123");
    expect(mockGet).toHaveBeenCalled();
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "test-user-123",
        email: "test@example.com",
        displayName: "Test User",
        photoURL: "https://example.com/photo.jpg",
        clubMemberships: [],
      })
    );
  });

  it("should initialize clubMemberships as empty array (AC: 3)", async () => {
    // Arrange
    const testUser = createMockUserRecord({
      uid: "test-user-456",
      email: "test2@example.com",
    });

    // Act
    const wrapped = testEnv.wrap(onUserCreate);
    await wrapped(testUser);

    // Assert
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        clubMemberships: [],
      })
    );
    // Verify it's an array
    const setCall = mockSet.mock.calls[0][0];
    expect(Array.isArray(setCall.clubMemberships)).toBe(true);
    expect(setCall.clubMemberships.length).toBe(0);
  });

  it("should handle missing optional fields gracefully", async () => {
    // Arrange - minimal user data
    const testUser = createMockUserRecord({
      uid: "test-user-789",
      email: undefined,
      displayName: undefined,
      photoURL: undefined,
    });

    // Act
    const wrapped = testEnv.wrap(onUserCreate);
    await wrapped(testUser);

    // Assert - should use defaults
    expect(mockSet).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: "test-user-789",
        email: "",
        displayName: "",
        photoURL: null,
      })
    );
  });

  it("should be idempotent - not overwrite existing doc", async () => {
    // Arrange - doc already exists
    mockGet.mockResolvedValue({ exists: true });

    const testUser = createMockUserRecord({
      uid: "test-user-existing",
      email: "existing@example.com",
    });

    // Act
    const wrapped = testEnv.wrap(onUserCreate);
    await wrapped(testUser);

    // Assert - set should NOT be called
    expect(mockGet).toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("should include createdAt and updatedAt timestamps", async () => {
    // Arrange
    const testUser = createMockUserRecord({
      uid: "test-user-timestamps",
    });

    // Act
    const wrapped = testEnv.wrap(onUserCreate);
    await wrapped(testUser);

    // Assert
    const setCall = mockSet.mock.calls[0][0];
    expect(setCall.createdAt).toBeDefined();
    expect(setCall.updatedAt).toBeDefined();
  });
});
