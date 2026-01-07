import { BoxerSearchResult } from "../types/discovery";
import { ParsedMatchIntent, TargetCriteria } from "../types/matchmaking";

/**
 * Story 6.1 - Intent Parser Module (Regex Fallback)
 *
 * Parses natural language match requests using regex patterns.
 * This is the fallback parser when LLM is unavailable.
 *
 * Invariants:
 * - Parser extracts intent, does not validate boxer existence
 * - Fuzzy matching done against provided boxer list
 * - All criteria are optional except boxer identification
 */

// ═══════════════════════════════════════════
// REGEX PATTERNS
// ═══════════════════════════════════════════

/**
 * Weight extraction patterns
 * Handles: "72kg", "72 kg", "72 kilos", "72 kilo", "72kg."
 */
const WEIGHT_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*kg(?:s|\.)?/i,
  /(\d+(?:\.\d+)?)\s*kilo(?:s|gram(?:s)?)?/i,
  /(?:at|weighing|weight)\s+(\d+(?:\.\d+)?)/i,
];

/**
 * Date extraction patterns
 * Handles: "on January 15", "for 15/01/2024", "15th January"
 */
const DATE_PATTERNS = [
  /(?:on|for)\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  /(?:on|for)\s+(\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*\d{0,4})/i,
  /(?:on|for)\s+((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{2,4})?)/i,
];

/**
 * Command patterns to identify intent type
 */
const MATCH_INTENT_PATTERNS = [
  /find\s+(?:a\s+)?match\s+for\s+(.+)/i,
  /match\s+(.+?)\s+(?:against|with|versus|vs\.?)/i,
  /(?:opponent|match)\s+for\s+(.+)/i,
  /find\s+(?:an?\s+)?(?:opponent|match)\s+for\s+(.+)/i,
  /(?:who|what)\s+(?:can|could)\s+(.+?)\s+fight/i,
  /(.+?)\s+needs?\s+(?:a\s+)?(?:match|opponent)/i,
];

/**
 * Category patterns
 */
const CATEGORY_PATTERNS = [
  /\b(junior|youth|elite)\b/i,
];

// ═══════════════════════════════════════════
// FUZZY MATCHING
// ═══════════════════════════════════════════

/**
 * Calculate Levenshtein distance between two strings
 *
 * @param a - First string
 * @param b - Second string
 * @returns Edit distance
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Calculate fuzzy match score (0-1, higher = better match)
 *
 * @param query - Search term
 * @param candidate - Candidate string
 * @returns Match score (0-1)
 */
function fuzzyScore(query: string, candidate: string): number {
  const q = query.toLowerCase().trim();
  const c = candidate.toLowerCase().trim();

  // Exact match
  if (q === c) return 1;

  // Contains match (high score)
  if (c.includes(q) || q.includes(c)) {
    return 0.9;
  }

  // Starts with match (high score)
  if (c.startsWith(q) || q.startsWith(c)) {
    return 0.85;
  }

  // Levenshtein-based score
  const distance = levenshteinDistance(q, c);
  const maxLen = Math.max(q.length, c.length);
  const score = 1 - distance / maxLen;

  return Math.max(0, score);
}

/**
 * Find matching boxers by name
 *
 * Returns all boxers that match above a threshold.
 *
 * @param nameQuery - Name to search for
 * @param boxers - Available boxers to match against
 * @param threshold - Minimum score to consider a match (default: 0.6)
 * @returns Matching boxers sorted by score
 */
export function findBoxersByName(
  nameQuery: string,
  boxers: BoxerSearchResult[],
  threshold = 0.6
): Array<{ boxer: BoxerSearchResult; score: number }> {
  const results: Array<{ boxer: BoxerSearchResult; score: number }> = [];

  for (const boxer of boxers) {
    // Check first name
    const firstNameScore = fuzzyScore(nameQuery, boxer.firstName);

    // Check last name
    const lastNameScore = fuzzyScore(nameQuery, boxer.lastName);

    // Check full name
    const fullName = `${boxer.firstName} ${boxer.lastName}`;
    const fullNameScore = fuzzyScore(nameQuery, fullName);

    // Use best score
    const bestScore = Math.max(firstNameScore, lastNameScore, fullNameScore);

    if (bestScore >= threshold) {
      results.push({ boxer, score: bestScore });
    }
  }

  // Sort by score descending
  return results.sort((a, b) => b.score - a.score);
}

// ═══════════════════════════════════════════
// EXTRACTION FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Extract weight from query string
 *
 * @param query - Natural language query
 * @returns Weight in kg or null
 */
export function extractWeight(query: string): number | null {
  for (const pattern of WEIGHT_PATTERNS) {
    const match = query.match(pattern);
    if (match) {
      const weight = parseFloat(match[1]);
      // Sanity check: boxing weights are typically 40-120kg
      if (weight >= 40 && weight <= 150) {
        return weight;
      }
    }
  }
  return null;
}

/**
 * Extract date from query string
 *
 * @param query - Natural language query
 * @returns ISO date string or null
 */
export function extractDate(query: string): string | null {
  for (const pattern of DATE_PATTERNS) {
    const match = query.match(pattern);
    if (match) {
      const dateStr = match[1];
      const parsed = parseDateString(dateStr);
      if (parsed) {
        return parsed.toISOString().split("T")[0];
      }
    }
  }
  return null;
}

/**
 * Parse various date string formats to Date object
 *
 * @param dateStr - Date string in various formats
 * @returns Date object or null
 */
function parseDateString(dateStr: string): Date | null {
  // Try DD/MM/YYYY or DD-MM-YYYY
  const slashMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (slashMatch) {
    const day = parseInt(slashMatch[1], 10);
    const month = parseInt(slashMatch[2], 10) - 1;
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000;
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  // Try "15th January 2024" or "January 15, 2024"
  const months: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };

  const normalized = dateStr.toLowerCase().replace(/(\d+)(?:st|nd|rd|th)/, "$1");

  // Try "15 January 2024"
  const dayFirstMatch = normalized.match(
    /(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*,?\s*(\d{2,4})?/
  );
  if (dayFirstMatch) {
    const day = parseInt(dayFirstMatch[1], 10);
    const monthStr = dayFirstMatch[2].substring(0, 3);
    const month = months[monthStr];
    let year = dayFirstMatch[3]
      ? parseInt(dayFirstMatch[3], 10)
      : new Date().getFullYear();
    if (year < 100) year += 2000;
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  // Try "January 15, 2024"
  const monthFirstMatch = normalized.match(
    /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})\s*,?\s*(\d{2,4})?/
  );
  if (monthFirstMatch) {
    const monthStr = monthFirstMatch[1].substring(0, 3);
    const month = months[monthStr];
    const day = parseInt(monthFirstMatch[2], 10);
    let year = monthFirstMatch[3]
      ? parseInt(monthFirstMatch[3], 10)
      : new Date().getFullYear();
    if (year < 100) year += 2000;
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) return date;
  }

  return null;
}

/**
 * Extract boxer name from query string
 *
 * @param query - Natural language query
 * @returns Extracted name or null
 */
export function extractBoxerName(query: string): string | null {
  for (const pattern of MATCH_INTENT_PATTERNS) {
    const match = query.match(pattern);
    if (match) {
      let name = match[1].trim();

      // Remove trailing punctuation including commas
      name = name.replace(/[,.\-!?\s]+$/, "").trim();

      // Remove weight references from the name (including preceding comma)
      name = name.replace(/,?\s*(?:at\s+)?\d+(?:\.\d+)?\s*kg(?:s)?/i, "").trim();
      name = name.replace(
        /,?\s*(?:at\s+)?\d+(?:\.\d+)?\s*kilo(?:s|gram(?:s)?)?/i,
        ""
      ).trim();

      // Remove date references
      name = name.replace(
        /\s*(?:on|for)\s+(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s+\w+(?:\s+\d{4})?)/i,
        ""
      ).trim();

      // Remove category references
      name = name.replace(/\s*\b(?:junior|youth|elite)\b/i, "").trim();

      if (name.length > 0) {
        return name;
      }
    }
  }
  return null;
}

/**
 * Extract category from query string
 *
 * @param query - Natural language query
 * @returns Category or null
 */
export function extractCategory(query: string): string | null {
  for (const pattern of CATEGORY_PATTERNS) {
    const match = query.match(pattern);
    if (match) {
      return match[1].toLowerCase();
    }
  }
  return null;
}

// ═══════════════════════════════════════════
// MAIN PARSER
// ═══════════════════════════════════════════

/**
 * Parse a natural language match request
 *
 * Extracts boxer name, weight, category, and date from the query.
 * Performs fuzzy matching against the provided boxer list.
 *
 * @param query - Natural language query (e.g., "Find a match for Jake, 72kg")
 * @param userClubBoxers - Boxers from the user's club to match against
 * @returns Parsed intent with matched boxer ID or error
 */
export function parseMatchIntent(
  query: string,
  userClubBoxers: BoxerSearchResult[]
): ParsedMatchIntent {
  const targetCriteria: TargetCriteria = {};

  // Extract components
  const boxerName = extractBoxerName(query);
  const weight = extractWeight(query);
  const showDate = extractDate(query);
  const category = extractCategory(query);

  // Build target criteria
  if (weight) {
    targetCriteria.weight = weight;
  }
  if (category) {
    targetCriteria.category = category;
  }

  // If no boxer name found, return error
  if (!boxerName) {
    return {
      sourceBoxerId: null,
      sourceBoxerName: null,
      targetCriteria,
      showDate,
      confidence: "low",
      parserUsed: "regex",
      error: "Could not identify boxer name in query",
    };
  }

  // Find matching boxers
  const matches = findBoxersByName(boxerName, userClubBoxers);

  // No matches found
  if (matches.length === 0) {
    return {
      sourceBoxerId: null,
      sourceBoxerName: boxerName,
      targetCriteria,
      showDate,
      confidence: "low",
      parserUsed: "regex",
      error: `No boxer named "${boxerName}" found in your club roster`,
    };
  }

  // Single high-confidence match
  if (matches.length === 1 || matches[0].score > 0.9) {
    const bestMatch = matches[0];
    return {
      sourceBoxerId: bestMatch.boxer.boxerId,
      sourceBoxerName: `${bestMatch.boxer.firstName} ${bestMatch.boxer.lastName}`,
      targetCriteria,
      showDate,
      confidence: bestMatch.score > 0.9 ? "high" : "medium",
      parserUsed: "regex",
    };
  }

  // Multiple possible matches - check if top matches are very close
  const topScore = matches[0].score;
  const closeMatches = matches.filter((m) => topScore - m.score < 0.1);

  if (closeMatches.length === 1) {
    // Only one close match
    const bestMatch = closeMatches[0];
    return {
      sourceBoxerId: bestMatch.boxer.boxerId,
      sourceBoxerName: `${bestMatch.boxer.firstName} ${bestMatch.boxer.lastName}`,
      targetCriteria,
      showDate,
      confidence: "medium",
      parserUsed: "regex",
    };
  }

  // Multiple close matches - ambiguous
  return {
    sourceBoxerId: null,
    sourceBoxerName: boxerName,
    targetCriteria,
    showDate,
    confidence: "low",
    parserUsed: "regex",
    error: `Multiple boxers match "${boxerName}". Please specify more clearly.`,
    ambiguousMatches: closeMatches.slice(0, 5).map((m) => ({
      boxerId: m.boxer.boxerId,
      name: `${m.boxer.firstName} ${m.boxer.lastName}`,
    })),
  };
}

/**
 * Build a simple explanation template (fallback when LLM unavailable)
 *
 * @param sourceBoxer - Source boxer
 * @param matchCount - Number of matches found
 * @param criteria - Target criteria used
 * @returns Template-based explanation
 */
export function buildTemplateExplanation(
  sourceBoxer: BoxerSearchResult,
  matchCount: number,
  criteria: TargetCriteria
): string {
  const parts: string[] = [];

  if (matchCount === 0) {
    parts.push(
      `No compliant matches found for ${sourceBoxer.firstName} ${sourceBoxer.lastName}.`
    );
    parts.push(
      `Searched for ${sourceBoxer.gender} boxers in the ${sourceBoxer.category} category`
    );
    parts.push(`around ${sourceBoxer.declaredWeight}kg.`);
    parts.push(
      "Try broadening your search criteria or check back later as more boxers become available."
    );
  } else {
    parts.push(
      `Found ${matchCount} potential match${matchCount === 1 ? "" : "es"} for`
    );
    parts.push(`${sourceBoxer.firstName} ${sourceBoxer.lastName}`);
    parts.push(
      `(${sourceBoxer.declaredWeight}kg, ${sourceBoxer.declaredBouts} bouts).`
    );
    parts.push("Matches are ranked by compatibility based on");
    parts.push("weight, age, and experience level.");

    if (criteria.weight) {
      parts.push(`Target weight: ${criteria.weight}kg.`);
    }
  }

  return parts.join(" ");
}
