import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import Anthropic from "@anthropic-ai/sdk";
import { BoxerSearchResult } from "../types/discovery";
import {
  ParsedMatchIntent,
  TargetCriteria,
  MatchCandidate,
  LLMIntentParseResult,
  DEFAULT_LLM_CONFIG,
} from "../types/matchmaking";
import { parseMatchIntent } from "./intentParser";

/**
 * Story 6.1 - LLM Integration Module
 *
 * Provides AI-powered intent parsing and explanation generation
 * using the Anthropic Claude API.
 *
 * Invariants:
 * - LLM is advisory only, does not make compliance decisions
 * - Graceful degradation to regex parsing on failure
 * - Rate limited separately from function rate limits
 * - API key secured via Firebase Functions config
 */

// ═══════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════

/**
 * Get Anthropic API key from Firebase Functions config
 * Set via: firebase functions:config:set anthropic.api_key="sk-ant-..."
 */
function getApiKey(): string | null {
  try {
    const config = functions.config();
    return config.anthropic?.api_key || null;
  } catch {
    return null;
  }
}

/**
 * LLM timeout in milliseconds (configurable via config)
 */
function getTimeout(): number {
  try {
    const config = functions.config();
    const timeout = parseInt(config.anthropic?.timeout || "0", 10);
    return timeout > 0 ? timeout : DEFAULT_LLM_CONFIG.timeout;
  } catch {
    return DEFAULT_LLM_CONFIG.timeout;
  }
}

// ═══════════════════════════════════════════
// RATE LIMITING
// ═══════════════════════════════════════════

const LLM_RATE_LIMIT_PER_MINUTE = DEFAULT_LLM_CONFIG.rateLimitPerMinute;

/**
 * Check LLM-specific rate limit for user
 * Separate from function-level rate limiting
 */
async function checkLLMRateLimit(
  db: admin.firestore.Firestore,
  userId: string
): Promise<boolean> {
  const now = Date.now();
  const windowStart = now - 60000;

  const rateLimitRef = db.collection("rateLimits").doc(`llm:${userId}`);

  try {
    return await db.runTransaction(async (transaction) => {
      const doc = await transaction.get(rateLimitRef);
      const data = doc.data() || { requests: [] };

      const recentRequests = (data.requests as number[]).filter(
        (ts: number) => ts > windowStart
      );

      if (recentRequests.length >= LLM_RATE_LIMIT_PER_MINUTE) {
        return false; // Rate limited
      }

      recentRequests.push(now);
      transaction.set(rateLimitRef, { requests: recentRequests });

      return true; // Allowed
    });
  } catch (error) {
    functions.logger.warn("LLM rate limit check failed", { error });
    return true; // Allow on error (fail open for rate limiting)
  }
}

// ═══════════════════════════════════════════
// SYSTEM PROMPTS
// ═══════════════════════════════════════════

const INTENT_PARSING_PROMPT = `You are a boxing matchmaking assistant. Parse the user's match request and extract structured information.

Given the user's query, extract:
1. boxer_name: The name of the boxer to find a match for (required)
2. weight_kg: Target weight in kilograms if specified (number or null)
3. criteria: Any additional criteria mentioned (array of strings)

IMPORTANT:
- Only extract information explicitly stated in the query
- Do not infer or assume values not mentioned
- If boxer name is unclear, set to null
- Weight must be a number (no units)

Respond with ONLY valid JSON in this exact format:
{"boxer_name": "string or null", "weight_kg": number or null, "criteria": ["string"]}`;

const EXPLANATION_PROMPT = `You are a boxing matchmaking assistant. Generate a brief, helpful explanation of the match results.

Focus on:
- Why these matches are compatible (weight, experience, age)
- Any notable considerations for each match
- Encouragement if no perfect matches found

Keep responses concise (2-3 sentences for overview, 1 sentence per top match).
Use plain language suitable for club officials who may not be technical.
Do not use markdown formatting.`;

// ═══════════════════════════════════════════
// LLM CLIENT
// ═══════════════════════════════════════════

/**
 * Create Anthropic client instance
 */
function createClient(): Anthropic | null {
  const apiKey = getApiKey();
  if (!apiKey) {
    return null;
  }

  return new Anthropic({ apiKey });
}

/**
 * Sanitize user input to prevent prompt injection
 * Removes potentially harmful patterns while preserving intent
 */
function sanitizeInput(input: string): string {
  // Remove potential injection attempts
  let sanitized = input
    // Remove system/assistant role markers
    .replace(/\b(system|assistant|human):/gi, "")
    // Remove XML-like tags
    .replace(/<\/?[^>]+(>|$)/g, "")
    // Remove excessive whitespace
    .replace(/\s+/g, " ")
    .trim();

  // Truncate to reasonable length
  if (sanitized.length > 500) {
    sanitized = sanitized.substring(0, 500);
  }

  return sanitized;
}

// ═══════════════════════════════════════════
// INTENT PARSING
// ═══════════════════════════════════════════

/**
 * Parse match intent using LLM
 *
 * Falls back to regex parsing on failure.
 *
 * @param query - Natural language query
 * @param userClubBoxers - Boxers from user's club for name matching
 * @param userId - User ID for rate limiting
 * @returns ParsedMatchIntent
 */
export async function parseMatchIntentWithLLM(
  query: string,
  userClubBoxers: BoxerSearchResult[],
  userId: string
): Promise<ParsedMatchIntent> {
  const db = admin.firestore();

  // Check LLM rate limit
  const allowed = await checkLLMRateLimit(db, userId);
  if (!allowed) {
    functions.logger.info("LLM rate limited, falling back to regex", { userId });
    return parseMatchIntent(query, userClubBoxers);
  }

  const client = createClient();
  if (!client) {
    functions.logger.warn("LLM API key not configured, falling back to regex");
    return parseMatchIntent(query, userClubBoxers);
  }

  const sanitizedQuery = sanitizeInput(query);
  const timeout = getTimeout();

  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("LLM timeout")), timeout);
    });

    // Build boxer name list for context
    const boxerNames = userClubBoxers
      .map((b) => `${b.firstName} ${b.lastName}`)
      .join(", ");

    const messagePromise = client.messages.create({
      model: DEFAULT_LLM_CONFIG.intentModel,
      max_tokens: DEFAULT_LLM_CONFIG.maxTokens,
      messages: [
        {
          role: "user",
          content: `${INTENT_PARSING_PROMPT}\n\nAvailable boxers in user's club: ${boxerNames}\n\nUser query: "${sanitizedQuery}"`,
        },
      ],
    });

    // Race between LLM call and timeout
    const response = await Promise.race([messagePromise, timeoutPromise]);

    // Extract text response
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from LLM");
    }

    const result = parseLLMResponse(textBlock.text);

    if (!result.success || !result.boxerName) {
      // LLM couldn't parse, fall back to regex
      functions.logger.info("LLM parse failed, falling back to regex", {
        error: result.error,
      });
      return parseMatchIntent(query, userClubBoxers);
    }

    // Match boxer name to roster
    const targetCriteria: TargetCriteria = {};
    if (result.weight) {
      targetCriteria.weight = result.weight;
    }
    if (result.criteria.length > 0) {
      targetCriteria.additionalCriteria = result.criteria;
    }

    // Find matching boxer in roster (using intentParser's fuzzy match)
    const regexResult = parseMatchIntent(
      `Find a match for ${result.boxerName}`,
      userClubBoxers
    );

    return {
      ...regexResult,
      targetCriteria: { ...regexResult.targetCriteria, ...targetCriteria },
      parserUsed: "llm",
      confidence: regexResult.sourceBoxerId ? "high" : "medium",
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    functions.logger.warn("LLM call failed, falling back to regex", {
      error: errorMessage,
    });

    // Graceful degradation to regex
    return parseMatchIntent(query, userClubBoxers);
  }
}

/**
 * Parse and validate LLM response JSON
 */
function parseLLMResponse(text: string): LLMIntentParseResult {
  try {
    // Try to extract JSON from response (in case of extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        boxerName: null,
        weight: null,
        criteria: [],
        error: "No JSON found in response",
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (typeof parsed !== "object" || parsed === null) {
      return {
        success: false,
        boxerName: null,
        weight: null,
        criteria: [],
        error: "Invalid JSON structure",
      };
    }

    const boxerName =
      typeof parsed.boxer_name === "string" ? parsed.boxer_name : null;
    const weight =
      typeof parsed.weight_kg === "number" ? parsed.weight_kg : null;
    const criteria = Array.isArray(parsed.criteria)
      ? parsed.criteria.filter((c: unknown) => typeof c === "string")
      : [];

    return {
      success: true,
      boxerName,
      weight,
      criteria,
    };
  } catch (error) {
    return {
      success: false,
      boxerName: null,
      weight: null,
      criteria: [],
      error: "JSON parse error",
    };
  }
}

// ═══════════════════════════════════════════
// EXPLANATION GENERATION
// ═══════════════════════════════════════════

/**
 * Generate match explanation using LLM
 *
 * Falls back to template-based explanation on failure.
 *
 * @param source - Source boxer
 * @param matches - Match candidates
 * @param query - Original query
 * @param userId - User ID for rate limiting
 * @returns Explanation string
 */
export async function generateMatchExplanation(
  source: BoxerSearchResult,
  matches: MatchCandidate[],
  query: string,
  userId: string
): Promise<string> {
  const db = admin.firestore();

  // Check LLM rate limit
  const allowed = await checkLLMRateLimit(db, userId);
  if (!allowed) {
    return buildFallbackExplanation(source, matches);
  }

  const client = createClient();
  if (!client) {
    return buildFallbackExplanation(source, matches);
  }

  const timeout = getTimeout();

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("LLM timeout")), timeout);
    });

    // Build match context
    const matchContext = matches
      .slice(0, 5)
      .map((m, i) => {
        return `${i + 1}. ${m.firstName} ${m.lastName} (${m.clubName}) - ${m.declaredWeight}kg, ${m.declaredBouts} bouts, score: ${m.complianceScore}/100`;
      })
      .join("\n");

    const sourceContext = `Source boxer: ${source.firstName} ${source.lastName}, ${source.declaredWeight}kg, ${source.declaredBouts} bouts, ${source.category} category`;

    const messagePromise = client.messages.create({
      model: DEFAULT_LLM_CONFIG.explanationModel,
      max_tokens: DEFAULT_LLM_CONFIG.maxTokens,
      messages: [
        {
          role: "user",
          content: `${EXPLANATION_PROMPT}\n\n${sourceContext}\n\nMatches found:\n${matchContext}\n\nOriginal query: "${sanitizeInput(query)}"`,
        },
      ],
    });

    const response = await Promise.race([messagePromise, timeoutPromise]);

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      throw new Error("No text response from LLM");
    }

    return textBlock.text.trim();
  } catch (error) {
    functions.logger.warn("LLM explanation failed, using fallback", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return buildFallbackExplanation(source, matches);
  }
}

/**
 * Build fallback template-based explanation
 */
function buildFallbackExplanation(
  source: BoxerSearchResult,
  matches: MatchCandidate[]
): string {
  if (matches.length === 0) {
    return `No compliant matches found for ${source.firstName} ${source.lastName} (${source.declaredWeight}kg, ${source.category}). Try adjusting your search criteria or check back later.`;
  }

  const topMatch = matches[0];
  const parts: string[] = [];

  parts.push(
    `Found ${matches.length} potential match${matches.length === 1 ? "" : "es"} for ${source.firstName} ${source.lastName}.`
  );

  parts.push(
    `Top match: ${topMatch.firstName} ${topMatch.lastName} from ${topMatch.clubName} (${topMatch.declaredWeight}kg, ${topMatch.declaredBouts} bouts) with a compatibility score of ${topMatch.complianceScore}/100.`
  );

  if (matches.length > 1) {
    parts.push(`${matches.length - 1} additional compatible opponent${matches.length > 2 ? "s" : ""} found.`);
  }

  return parts.join(" ");
}

// ═══════════════════════════════════════════
// EXPORTS FOR TESTING
// ═══════════════════════════════════════════

export const __testing = {
  sanitizeInput,
  parseLLMResponse,
  buildFallbackExplanation,
  INTENT_PARSING_PROMPT,
  EXPLANATION_PROMPT,
};
