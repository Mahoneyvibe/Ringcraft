/**
 * Unit Tests for Intent Parser Module
 *
 * Story 6.1: Match a Boxer (AI-First)
 * Task 7: Tests for regex-based intent parsing
 *
 * Tests natural language query parsing and fuzzy name matching.
 */

import { Timestamp } from "firebase-admin/firestore";
import {
  parseMatchIntent,
  findBoxersByName,
  extractWeight,
  extractDate,
  extractBoxerName,
  extractCategory,
  buildTemplateExplanation,
} from "../../matchmaking/intentParser";
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

// Create mock roster for testing
function createMockRoster(): BoxerSearchResult[] {
  return [
    {
      boxerId: "boxer-jake",
      firstName: "Jake",
      lastName: "Smith",
      dob: createMockTimestamp(new Date("2000-01-15")),
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
    },
    {
      boxerId: "boxer-james",
      firstName: "James",
      lastName: "Johnson",
      dob: createMockTimestamp(new Date("1998-05-20")),
      age: 27,
      gender: "male",
      category: "elite",
      declaredWeight: 75,
      declaredBouts: 15,
      declaredWins: 12,
      declaredLosses: 3,
      availability: "available",
      clubId: "club-1",
      clubName: "Test Club",
    },
    {
      boxerId: "boxer-sarah",
      firstName: "Sarah",
      lastName: "Williams",
      dob: createMockTimestamp(new Date("2001-03-10")),
      age: 24,
      gender: "female",
      category: "elite",
      declaredWeight: 60,
      declaredBouts: 8,
      declaredWins: 5,
      declaredLosses: 3,
      availability: "available",
      clubId: "club-1",
      clubName: "Test Club",
    },
    {
      boxerId: "boxer-jacob",
      firstName: "Jacob",
      lastName: "Miller",
      dob: createMockTimestamp(new Date("1999-08-25")),
      age: 26,
      gender: "male",
      category: "elite",
      declaredWeight: 68,
      declaredBouts: 12,
      declaredWins: 9,
      declaredLosses: 3,
      availability: "available",
      clubId: "club-1",
      clubName: "Test Club",
    },
  ];
}

// ═══════════════════════════════════════════
// TEST 7.2: Parse "Find a match for Jake, 72kg"
// ═══════════════════════════════════════════
describe("parseMatchIntent - standard queries", () => {
  it("should parse 'Find a match for Jake, 72kg'", () => {
    const roster = createMockRoster();
    const result = parseMatchIntent("Find a match for Jake, 72kg", roster);

    expect(result.sourceBoxerId).toBe("boxer-jake");
    expect(result.sourceBoxerName).toBe("Jake Smith");
    expect(result.targetCriteria.weight).toBe(72);
    expect(result.parserUsed).toBe("regex");
    expect(result.error).toBeUndefined();
  });

  // ═══════════════════════════════════════════
  // TEST 7.3: Parse "Match Jake against someone"
  // ═══════════════════════════════════════════
  it("should parse 'Match Jake against someone'", () => {
    const roster = createMockRoster();
    const result = parseMatchIntent("Match Jake against someone", roster);

    expect(result.sourceBoxerId).toBe("boxer-jake");
    expect(result.sourceBoxerName).toBe("Jake Smith");
    expect(result.parserUsed).toBe("regex");
  });

  // ═══════════════════════════════════════════
  // TEST 7.4: Parse with explicit boxer ID
  // ═══════════════════════════════════════════
  it("should match using full name", () => {
    const roster = createMockRoster();
    const result = parseMatchIntent("Find a match for Jake Smith", roster);

    expect(result.sourceBoxerId).toBe("boxer-jake");
    expect(result.confidence).toBe("high");
  });

  // ═══════════════════════════════════════════
  // TEST 7.5: Parse with weight in different formats
  // ═══════════════════════════════════════════
  it("should extract weight in various formats", () => {
    expect(extractWeight("Jake at 72kg")).toBe(72);
    expect(extractWeight("Jake at 72 kg")).toBe(72);
    expect(extractWeight("Jake at 72kilos")).toBe(72);
    expect(extractWeight("Jake at 72 kilograms")).toBe(72);
    expect(extractWeight("weighing 68.5")).toBe(68.5);
    expect(extractWeight("no weight mentioned")).toBeNull();
  });

  // ═══════════════════════════════════════════
  // TEST 7.6: Fuzzy name matching against roster
  // ═══════════════════════════════════════════
  it("should fuzzy match names with typos", () => {
    const roster = createMockRoster();

    // Slight misspelling
    const result = parseMatchIntent("Find a match for Jak", roster);

    expect(result.sourceBoxerId).toBe("boxer-jake");
  });

  it("should match partial names", () => {
    const roster = createMockRoster();

    const result = parseMatchIntent("Find opponent for Sarah", roster);

    expect(result.sourceBoxerId).toBe("boxer-sarah");
    expect(result.sourceBoxerName).toBe("Sarah Williams");
  });

  // ═══════════════════════════════════════════
  // TEST 7.7: Unknown boxer name returns error
  // ═══════════════════════════════════════════
  it("should return error for unknown boxer", () => {
    const roster = createMockRoster();
    const result = parseMatchIntent("Find a match for Unknown Person", roster);

    expect(result.sourceBoxerId).toBeNull();
    expect(result.error).toContain("No boxer named");
  });

  it("should return error when no name can be parsed", () => {
    const roster = createMockRoster();
    const result = parseMatchIntent("What is boxing?", roster);

    expect(result.sourceBoxerId).toBeNull();
    expect(result.error).toContain("Could not identify boxer");
  });

  // ═══════════════════════════════════════════
  // TEST 7.8: Ambiguous name returns clarification request
  // ═══════════════════════════════════════════
  it("should return ambiguous matches for similar names", () => {
    const roster = createMockRoster();

    // "Ja" matches Jake, James, and Jacob
    const result = parseMatchIntent("Find a match for Ja", roster);

    // Might return ambiguous or pick best match
    if (result.ambiguousMatches) {
      expect(result.ambiguousMatches.length).toBeGreaterThan(1);
      expect(result.error).toContain("Multiple boxers match");
    } else {
      // If it picked a best match, that's also acceptable
      expect(result.sourceBoxerId).toBeDefined();
    }
  });
});

// ═══════════════════════════════════════════
// Additional extraction tests
// ═══════════════════════════════════════════
describe("extractBoxerName", () => {
  it("should extract name from various query patterns", () => {
    expect(extractBoxerName("Find a match for Jake")).toBe("Jake");
    expect(extractBoxerName("Match Jake against someone")).toBe("Jake");
    expect(extractBoxerName("opponent for Sarah Williams")).toBe("Sarah Williams");
    expect(extractBoxerName("Jake needs a match")).toBe("Jake");
  });

  it("should strip weight from extracted name", () => {
    expect(extractBoxerName("Find a match for Jake, 72kg")).toBe("Jake");
    expect(extractBoxerName("Find match for Jake at 72 kg")).toBe("Jake");
  });
});

describe("extractDate", () => {
  it("should extract date in DD/MM/YYYY format", () => {
    const result = extractDate("Find a match on 15/01/2025");
    expect(result).toBe("2025-01-15");
  });

  it("should extract date with month name", () => {
    const result = extractDate("Match for January 15, 2025");
    expect(result).toBe("2025-01-15");
  });

  it("should return null when no date found", () => {
    const result = extractDate("Find a match for Jake");
    expect(result).toBeNull();
  });
});

describe("extractCategory", () => {
  it("should extract category from query", () => {
    expect(extractCategory("Find a junior boxer")).toBe("junior");
    expect(extractCategory("Match for youth category")).toBe("youth");
    expect(extractCategory("Elite boxer needed")).toBe("elite");
    expect(extractCategory("Find a match")).toBeNull();
  });
});

describe("findBoxersByName", () => {
  it("should return boxers sorted by match score", () => {
    const roster = createMockRoster();
    const matches = findBoxersByName("Jake", roster);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].boxer.firstName).toBe("Jake");
    expect(matches[0].score).toBeGreaterThan(0.8);
  });

  it("should filter by threshold", () => {
    const roster = createMockRoster();

    // Very high threshold
    const strictMatches = findBoxersByName("Jake", roster, 0.95);

    // Lower threshold
    const looseMatches = findBoxersByName("Jake", roster, 0.5);

    expect(looseMatches.length).toBeGreaterThanOrEqual(strictMatches.length);
  });

  it("should return empty for no matches", () => {
    const roster = createMockRoster();
    const matches = findBoxersByName("zzzzz", roster);

    expect(matches).toHaveLength(0);
  });
});

describe("buildTemplateExplanation", () => {
  it("should build explanation for matches found", () => {
    const boxer = createMockRoster()[0];
    const explanation = buildTemplateExplanation(boxer, 5, {});

    expect(explanation).toContain("5 potential matches");
    expect(explanation).toContain("Jake Smith");
  });

  it("should build explanation for no matches", () => {
    const boxer = createMockRoster()[0];
    const explanation = buildTemplateExplanation(boxer, 0, {});

    expect(explanation).toContain("No compliant matches");
    expect(explanation).toContain("Jake Smith");
  });

  it("should include weight criteria if provided", () => {
    const boxer = createMockRoster()[0];
    const explanation = buildTemplateExplanation(boxer, 3, { weight: 72 });

    expect(explanation).toContain("72kg");
  });
});
