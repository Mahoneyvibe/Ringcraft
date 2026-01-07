import { BoxerSearchResult } from "./discovery";

/**
 * Story 6.1 - Match a Boxer (AI-First)
 *
 * Types for AI-driven matchmaking functionality.
 * Enables natural language match requests with compliance filtering.
 *
 * Invariants:
 * - Compliance is computed at runtime, never stored
 * - AI responses are advisory only
 * - Age computed from DOB + show date
 */

// ═══════════════════════════════════════════
// REQUEST/RESPONSE TYPES
// ═══════════════════════════════════════════

/**
 * Request for findMatch callable function
 *
 * Supports both natural language queries and explicit boxer ID.
 * Natural language is parsed by LLM with regex fallback.
 */
export interface FindMatchRequest {
  // Natural language query (e.g., "Find a match for Jake, 72kg")
  naturalLanguageQuery: string;

  // Optional: Explicit boxer ID (bypasses name parsing)
  boxerId?: string;

  // Optional: Target show date for age calculation (defaults to today)
  showDate?: string; // ISO date string

  // Optional: Additional options
  options?: FindMatchOptions;
}

/**
 * Options for match finding
 */
export interface FindMatchOptions {
  // Maximum number of matches to return (default: 10)
  limit?: number;

  // Whether to include explanation in response (default: true)
  includeExplanation?: boolean;

  // Weight tolerance override in kg (default: uses category rules)
  weightTolerance?: number;

  // Experience tolerance override (default: uses experience rules)
  experienceTolerance?: number;
}

/**
 * Response from findMatch callable function
 */
export interface FindMatchResponse {
  success: boolean;
  matches: MatchCandidate[];
  explanation: string; // AI-generated or template-based
  parsedIntent: ParsedMatchIntent;
  sourceBoxer: BoxerSearchResult | null; // The boxer we're finding a match for
  total: number; // Total candidates before filtering
  filtered: number; // How many were filtered out for compliance
}

// ═══════════════════════════════════════════
// MATCH CANDIDATE TYPES
// ═══════════════════════════════════════════

/**
 * A potential match candidate with compliance information
 *
 * Extends BoxerSearchResult with computed compliance data.
 * Compliance score and notes are DERIVED, never stored.
 */
export interface MatchCandidate extends BoxerSearchResult {
  // Compliance score (0-100, higher = better match)
  complianceScore: number;

  // Human-readable compliance notes
  complianceNotes: string[];

  // Detailed compliance breakdown
  compliance: ComplianceResult;
}

// ═══════════════════════════════════════════
// INTENT PARSING TYPES
// ═══════════════════════════════════════════

/**
 * Parsed intent from natural language query
 *
 * Extracted by LLM or regex fallback parser.
 */
export interface ParsedMatchIntent {
  // Identified source boxer ID (from roster lookup)
  sourceBoxerId: string | null;

  // Boxer name as parsed from query
  sourceBoxerName: string | null;

  // Target criteria extracted from query
  targetCriteria: TargetCriteria;

  // Target show date (ISO string)
  showDate: string | null;

  // Confidence level of parsing (for LLM)
  confidence: "high" | "medium" | "low";

  // Whether LLM or regex was used
  parserUsed: "llm" | "regex";

  // If parsing failed or was ambiguous
  error?: string;

  // If multiple boxers matched the name
  ambiguousMatches?: Array<{ boxerId: string; name: string }>;
}

/**
 * Target criteria for match search
 */
export interface TargetCriteria {
  // Weight in kg (if specified in query)
  weight?: number;

  // Category (if specified in query)
  category?: string;

  // Any additional criteria mentioned
  additionalCriteria?: string[];
}

// ═══════════════════════════════════════════
// COMPLIANCE TYPES
// ═══════════════════════════════════════════

/**
 * Result of compliance evaluation between two boxers
 *
 * All compliance data is COMPUTED at runtime, never persisted.
 */
export interface ComplianceResult {
  // Overall compliance status
  isCompliant: boolean;

  // Overall score (0-100)
  score: number;

  // Issues that make the match non-compliant
  issues: ComplianceIssue[];

  // Warnings (compliant but worth noting)
  warnings: ComplianceWarning[];

  // Individual check results
  checks: {
    age: ComplianceCheckResult;
    weight: ComplianceCheckResult;
    experience: ComplianceCheckResult;
  };
}

/**
 * Result of a single compliance check
 */
export interface ComplianceCheckResult {
  passed: boolean;
  score: number; // 0-100 for this check
  details: string;
  sourceValue: number;
  targetValue: number;
  difference: number;
  tolerance: number;
}

/**
 * A compliance issue (blocking)
 */
export interface ComplianceIssue {
  type: "age" | "weight" | "experience" | "category" | "availability";
  severity: "high" | "medium";
  message: string;
}

/**
 * A compliance warning (non-blocking)
 */
export interface ComplianceWarning {
  type: "age" | "weight" | "experience" | "record";
  message: string;
}

// ═══════════════════════════════════════════
// COMPLIANCE RULES CONFIGURATION
// ═══════════════════════════════════════════

/**
 * Configuration for compliance rules
 *
 * These are reasonable defaults based on England Boxing guidelines.
 * Can be overridden per-request or configured at system level.
 */
export interface ComplianceRulesConfig {
  // Age ranges per category
  ageRanges: {
    junior: { min: 10; max: 14 };
    youth: { min: 14; max: 17 };
    elite: { min: 17; max: 40 };
  };

  // Weight tolerance in kg per weight class
  weightTolerances: {
    light: number; // <60kg: 1kg tolerance
    medium: number; // 60-75kg: 2kg tolerance
    heavy: number; // >75kg: 3kg tolerance
  };

  // Experience tolerance (max bout difference)
  experienceTolerances: {
    novice: number; // 0-5 bouts: max 2 bout difference
    intermediate: number; // 6-15 bouts: max 4 bout difference
    experienced: number; // 16+ bouts: max 6 bout difference
  };
}

/**
 * Default compliance rules
 */
export const DEFAULT_COMPLIANCE_RULES: ComplianceRulesConfig = {
  ageRanges: {
    junior: { min: 10, max: 14 },
    youth: { min: 14, max: 17 },
    elite: { min: 17, max: 40 },
  },
  weightTolerances: {
    light: 1,
    medium: 2,
    heavy: 3,
  },
  experienceTolerances: {
    novice: 2,
    intermediate: 4,
    experienced: 6,
  },
};

// ═══════════════════════════════════════════
// LLM SERVICE TYPES
// ═══════════════════════════════════════════

/**
 * LLM provider interface for abstraction
 */
export interface LLMProvider {
  parseIntent(
    query: string,
    boxerNames: string[]
  ): Promise<LLMIntentParseResult>;
  generateExplanation(
    source: BoxerSearchResult,
    matches: MatchCandidate[],
    query: string
  ): Promise<string>;
}

/**
 * Result from LLM intent parsing
 */
export interface LLMIntentParseResult {
  success: boolean;
  boxerName: string | null;
  weight: number | null;
  criteria: string[];
  error?: string;
}

/**
 * LLM service configuration
 */
export interface LLMServiceConfig {
  // Timeout in milliseconds (default: 10000)
  timeout: number;

  // Max tokens for responses
  maxTokens: number;

  // Model to use for intent parsing
  intentModel: string;

  // Model to use for explanation generation
  explanationModel: string;

  // Rate limit per user per minute
  rateLimitPerMinute: number;
}

/**
 * Default LLM service configuration
 */
export const DEFAULT_LLM_CONFIG: LLMServiceConfig = {
  timeout: 10000, // 10 seconds
  maxTokens: 500,
  intentModel: "claude-3-haiku-20240307",
  explanationModel: "claude-3-haiku-20240307",
  rateLimitPerMinute: 10,
};
