/**
 * Unit Tests for Compliance Module
 *
 * Story 6.1: Match a Boxer (AI-First)
 * Task 6: Tests for compliance filtering logic
 *
 * Tests age, weight, and experience compliance calculations.
 */

import { Timestamp } from "firebase-admin/firestore";
import {
  calculateAgeAtDate,
  checkAgeCompliance,
  checkWeightCompliance,
  checkExperienceCompliance,
  evaluateMatchCompliance,
  generateComplianceNotes,
} from "../../matchmaking/compliance";
import { BoxerSearchResult } from "../../types/discovery";

// Helper to create a Timestamp mock
function createMockTimestamp(date: Date): Timestamp {
  return {
    toDate: () => date,
    seconds: Math.floor(date.getTime() / 1000),
    nanoseconds: 0,
    toMillis: () => date.getTime(),
    isEqual: () => false,
    valueOf: () => "",
  } as unknown as Timestamp;
}

// Helper to create a mock boxer
function createMockBoxer(
  overrides: Partial<BoxerSearchResult> = {}
): BoxerSearchResult {
  const dob = new Date("2000-01-15");
  return {
    boxerId: "boxer-1",
    firstName: "Test",
    lastName: "Boxer",
    dob: createMockTimestamp(dob),
    age: 25,
    gender: "male",
    category: "elite",
    declaredWeight: 72,
    declaredBouts: 10,
    declaredWins: 7,
    declaredLosses: 3,
    availability: "available",
    clubId: "club-1",
    clubName: "Test Club",
    ...overrides,
  };
}

// ═══════════════════════════════════════════
// TEST 6.2: Age compliance within same category
// ═══════════════════════════════════════════
describe("checkAgeCompliance", () => {
  it("should pass for boxers of same age in same category", () => {
    const result = checkAgeCompliance(22, 22, "elite");

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.difference).toBe(0);
  });

  it("should pass for small age difference in elite category", () => {
    const result = checkAgeCompliance(22, 24, "elite");

    expect(result.passed).toBe(true);
    expect(result.score).toBe(80); // 100 - 2*10
    expect(result.difference).toBe(2);
  });

  it("should pass for age difference at elite max (5 years)", () => {
    const result = checkAgeCompliance(22, 27, "elite");

    expect(result.passed).toBe(true);
    expect(result.score).toBe(50); // 100 - 5*10
    expect(result.difference).toBe(5);
  });

  // ═══════════════════════════════════════════
  // TEST 6.3: Age compliance across category boundaries
  // ═══════════════════════════════════════════
  it("should fail for age difference exceeding elite max", () => {
    const result = checkAgeCompliance(22, 28, "elite");

    expect(result.passed).toBe(false);
    expect(result.difference).toBe(6);
    expect(result.tolerance).toBe(5);
    expect(result.details).toContain("exceeds maximum");
  });

  it("should fail when source boxer is outside category range", () => {
    // Junior is 10-14, source age 16 is outside
    const result = checkAgeCompliance(16, 13, "junior");

    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.details).toContain("outside junior range");
  });

  it("should fail when target boxer is outside category range", () => {
    // Elite is 17-40, target age 15 is outside
    const result = checkAgeCompliance(22, 15, "elite");

    expect(result.passed).toBe(false);
    expect(result.details).toContain("Target boxer age 15 is outside elite range");
  });

  it("should use stricter limits for junior category", () => {
    // Juniors: max 2 year difference
    const result = checkAgeCompliance(12, 14, "junior");

    expect(result.passed).toBe(true);
    expect(result.tolerance).toBe(2);

    const failResult = checkAgeCompliance(11, 14, "junior");
    expect(failResult.passed).toBe(false);
  });

  it("should use stricter limits for youth category", () => {
    // Youth: max 2 year difference
    const result = checkAgeCompliance(15, 16, "youth");

    expect(result.passed).toBe(true);
    expect(result.tolerance).toBe(2);
  });
});

// ═══════════════════════════════════════════
// TEST 6.4 & 6.5: Weight compliance
// ═══════════════════════════════════════════
describe("checkWeightCompliance", () => {
  it("should give perfect score for exact weight match", () => {
    const result = checkWeightCompliance(72, 72, "elite");

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.difference).toBe(0);
  });

  it("should pass for weight within light class tolerance (1kg)", () => {
    const result = checkWeightCompliance(55, 55.5, "elite");

    expect(result.passed).toBe(true);
    expect(result.tolerance).toBe(1);
    expect(result.difference).toBe(0.5);
  });

  it("should pass for weight within medium class tolerance (2kg)", () => {
    const result = checkWeightCompliance(68, 70, "elite");

    expect(result.passed).toBe(true);
    expect(result.tolerance).toBe(2);
    expect(result.difference).toBe(2);
  });

  it("should pass for weight within heavy class tolerance (3kg)", () => {
    const result = checkWeightCompliance(85, 88, "elite");

    expect(result.passed).toBe(true);
    expect(result.tolerance).toBe(3);
    expect(result.difference).toBe(3);
  });

  it("should fail for weight outside tolerance", () => {
    const result = checkWeightCompliance(55, 58, "elite");

    expect(result.passed).toBe(false);
    expect(result.tolerance).toBe(1); // Light class
    expect(result.difference).toBe(3);
    expect(result.details).toContain("exceeds");
  });

  it("should reduce score based on difference within tolerance", () => {
    // At edge of tolerance, score should be around 60
    const result = checkWeightCompliance(68, 70, "elite");

    expect(result.passed).toBe(true);
    expect(result.score).toBeLessThan(100);
    expect(result.score).toBeGreaterThanOrEqual(60);
  });
});

// ═══════════════════════════════════════════
// TEST 6.6 & 6.7: Experience compliance
// ═══════════════════════════════════════════
describe("checkExperienceCompliance", () => {
  it("should give perfect score for equal experience", () => {
    const result = checkExperienceCompliance(10, 10);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(result.difference).toBe(0);
  });

  it("should pass for novice boxers within tolerance", () => {
    // Novice (0-5 bouts): max 2 bout difference
    const result = checkExperienceCompliance(3, 5);

    expect(result.passed).toBe(true);
    expect(result.tolerance).toBe(2);
    expect(result.difference).toBe(2);
  });

  it("should pass for intermediate boxers within tolerance", () => {
    // Intermediate (6-15 bouts): max 4 bout difference
    const result = checkExperienceCompliance(10, 14);

    expect(result.passed).toBe(true);
    expect(result.tolerance).toBe(4);
    expect(result.difference).toBe(4);
  });

  it("should pass for experienced boxers within tolerance", () => {
    // Experienced (16+ bouts): max 6 bout difference
    const result = checkExperienceCompliance(20, 25);

    expect(result.passed).toBe(true);
    expect(result.tolerance).toBe(6);
    expect(result.difference).toBe(5);
  });

  it("should fail for mismatched novice boxers", () => {
    const result = checkExperienceCompliance(2, 6);

    expect(result.passed).toBe(false);
    expect(result.difference).toBe(4);
    expect(result.tolerance).toBe(2);
    expect(result.details).toContain("exceeds");
  });

  it("should fail for severely mismatched experienced boxers", () => {
    const result = checkExperienceCompliance(20, 30);

    expect(result.passed).toBe(false);
    expect(result.difference).toBe(10);
    expect(result.tolerance).toBe(6);
  });
});

// ═══════════════════════════════════════════
// TEST 6.8: Combined compliance evaluation
// ═══════════════════════════════════════════
describe("evaluateMatchCompliance", () => {
  it("should return compliant result when all checks pass", () => {
    const source = createMockBoxer({
      dob: createMockTimestamp(new Date("2000-06-15")),
      declaredWeight: 72,
      declaredBouts: 10,
      category: "elite",
      gender: "male",
      availability: "available",
    });

    const target = createMockBoxer({
      boxerId: "boxer-2",
      dob: createMockTimestamp(new Date("1999-03-20")),
      declaredWeight: 73,
      declaredBouts: 12,
      category: "elite",
      gender: "male",
      availability: "available",
    });

    const showDate = new Date("2025-07-01");
    const result = evaluateMatchCompliance(source, target, showDate);

    expect(result.isCompliant).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.score).toBeGreaterThan(0);
    expect(result.checks.age.passed).toBe(true);
    expect(result.checks.weight.passed).toBe(true);
    expect(result.checks.experience.passed).toBe(true);
  });

  it("should return non-compliant for category mismatch", () => {
    const source = createMockBoxer({ category: "elite" });
    const target = createMockBoxer({ category: "youth" });

    const result = evaluateMatchCompliance(source, target, new Date());

    expect(result.isCompliant).toBe(false);
    expect(result.issues.some((i) => i.type === "category")).toBe(true);
  });

  it("should return non-compliant for gender mismatch", () => {
    const source = createMockBoxer({ gender: "male" });
    const target = createMockBoxer({ gender: "female" });

    const result = evaluateMatchCompliance(source, target, new Date());

    expect(result.isCompliant).toBe(false);
    expect(result.issues.some((i) => i.message.includes("Gender"))).toBe(true);
  });

  it("should return non-compliant for unavailable target", () => {
    const source = createMockBoxer();
    const target = createMockBoxer({ availability: "injured" });

    const result = evaluateMatchCompliance(source, target, new Date());

    expect(result.isCompliant).toBe(false);
    expect(result.issues.some((i) => i.type === "availability")).toBe(true);
  });

  it("should add warnings for edge cases", () => {
    const source = createMockBoxer({
      dob: createMockTimestamp(new Date("2000-01-15")),
      declaredWeight: 72,
      declaredBouts: 10,
    });

    // Target with significant but compliant differences
    const target = createMockBoxer({
      dob: createMockTimestamp(new Date("1997-01-15")), // 3 year difference
      declaredWeight: 73.5, // 1.5kg difference
      declaredBouts: 13, // 3 bout difference
    });

    const result = evaluateMatchCompliance(source, target, new Date("2025-06-01"));

    expect(result.isCompliant).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════
// TEST 6.9: Age calculated correctly at future show date
// ═══════════════════════════════════════════
describe("calculateAgeAtDate", () => {
  it("should calculate age correctly at current date", () => {
    const dob = createMockTimestamp(new Date("2000-06-15"));
    const targetDate = new Date("2025-06-15");

    const age = calculateAgeAtDate(dob, targetDate);

    expect(age).toBe(25);
  });

  it("should calculate age correctly before birthday", () => {
    const dob = createMockTimestamp(new Date("2000-06-15"));
    const targetDate = new Date("2025-06-14");

    const age = calculateAgeAtDate(dob, targetDate);

    expect(age).toBe(24);
  });

  it("should calculate age correctly after birthday", () => {
    const dob = createMockTimestamp(new Date("2000-06-15"));
    const targetDate = new Date("2025-06-16");

    const age = calculateAgeAtDate(dob, targetDate);

    expect(age).toBe(25);
  });

  it("should calculate age at future show date", () => {
    const dob = createMockTimestamp(new Date("2000-01-15"));
    const futureShowDate = new Date("2026-01-20");

    const age = calculateAgeAtDate(dob, futureShowDate);

    expect(age).toBe(26);
  });

  it("should handle edge case of same birthday", () => {
    const dob = createMockTimestamp(new Date("2000-03-15"));
    const targetDate = new Date("2025-03-15");

    const age = calculateAgeAtDate(dob, targetDate);

    expect(age).toBe(25);
  });
});

// ═══════════════════════════════════════════
// generateComplianceNotes tests
// ═══════════════════════════════════════════
describe("generateComplianceNotes", () => {
  it("should generate positive notes for compliant match", () => {
    const source = createMockBoxer();
    const target = createMockBoxer({
      dob: createMockTimestamp(new Date("2000-01-10")),
      declaredWeight: 72,
      declaredBouts: 10,
    });

    const compliance = evaluateMatchCompliance(source, target, new Date());
    const notes = generateComplianceNotes(compliance);

    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0]).toContain("Compliance score");
  });

  it("should generate issue notes for non-compliant match", () => {
    const source = createMockBoxer({ category: "elite" });
    const target = createMockBoxer({ category: "youth" });

    const compliance = evaluateMatchCompliance(source, target, new Date());
    const notes = generateComplianceNotes(compliance);

    expect(notes[0]).toBe("Non-compliant match");
    expect(notes.some((n) => n.includes("Issue"))).toBe(true);
  });
});
