import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { BoxerSearchResult } from "../types/discovery";
import { Boxer } from "../types/boxer";
import {
  FindMatchRequest,
  FindMatchResponse,
  MatchCandidate,
  ParsedMatchIntent,
} from "../types/matchmaking";
import { buildTemplateExplanation } from "./intentParser";
import { evaluateMatchCompliance, generateComplianceNotes, calculateAgeAtDate } from "./compliance";
import { parseMatchIntentWithLLM, generateMatchExplanation } from "./llmService";

/**
 * Story 6.1 - Find Match Callable Function
 *
 * AI-first matchmaking function that parses natural language requests
 * and returns compliant match candidates.
 *
 * Invariants:
 * - Compliance is computed at runtime, never stored
 * - Age computed from DOB + show date
 * - Only returns boxers from other clubs
 * - Rate limited per user
 */

// ═══════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const RATE_LIMIT_PER_MINUTE = 20; // Function-level rate limit

// ═══════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════

/**
 * Calculate age from date of birth
 */
function calculateAge(dob: Timestamp): number {
  const today = new Date();
  const birthDate = dob.toDate();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Get all club IDs the user is a member of
 */
async function getUserClubIds(
  db: admin.firestore.Firestore,
  userId: string
): Promise<string[]> {
  const membershipQuery = await db
    .collectionGroup("members")
    .where("userId", "==", userId)
    .get();

  if (membershipQuery.empty) {
    return [];
  }

  const clubIds: string[] = [];
  for (const doc of membershipQuery.docs) {
    const clubId = doc.ref.parent.parent?.id;
    if (clubId) {
      clubIds.push(clubId);
    }
  }

  return clubIds;
}

/**
 * Get boxers from user's clubs (for intent parsing)
 */
async function getUserClubBoxers(
  db: admin.firestore.Firestore,
  userClubIds: string[]
): Promise<BoxerSearchResult[]> {
  const boxers: BoxerSearchResult[] = [];

  for (const clubId of userClubIds) {
    const clubDoc = await db.collection("clubs").doc(clubId).get();
    const clubName = clubDoc.data()?.name || "Unknown Club";

    const boxerDocs = await db
      .collection("clubs")
      .doc(clubId)
      .collection("boxers")
      .where("dataStatus", "==", "active")
      .get();

    for (const doc of boxerDocs.docs) {
      const boxer = doc.data() as Boxer;
      boxers.push({
        boxerId: boxer.boxerId,
        firstName: boxer.firstName,
        lastName: boxer.lastName,
        dob: boxer.dob,
        age: calculateAge(boxer.dob),
        gender: boxer.gender,
        category: boxer.category,
        declaredWeight: boxer.declaredWeight,
        declaredBouts: boxer.declaredBouts,
        declaredWins: boxer.declaredWins,
        declaredLosses: boxer.declaredLosses,
        availability: boxer.availability,
        clubId,
        clubName,
      });
    }
  }

  return boxers;
}

/**
 * Search for potential match candidates from other clubs
 */
async function searchCandidates(
  db: admin.firestore.Firestore,
  source: BoxerSearchResult,
  userClubIds: string[],
  limit: number
): Promise<BoxerSearchResult[]> {
  const candidates: BoxerSearchResult[] = [];
  const clubIdsNeeded = new Set<string>();
  const candidateData: Array<{ boxer: Boxer; clubId: string }> = [];

  // Query boxers with matching gender and category
  let query: admin.firestore.Query = db.collectionGroup("boxers");
  query = query.where("dataStatus", "==", "active");
  query = query.where("gender", "==", source.gender);
  query = query.where("category", "==", source.category);
  query = query.where("availability", "==", "available");

  const snapshot = await query.get();

  for (const doc of snapshot.docs) {
    const clubId = doc.ref.parent.parent?.id;
    if (!clubId) continue;

    // Exclude own clubs
    if (userClubIds.includes(clubId)) continue;

    const boxer = doc.data() as Boxer;
    candidateData.push({ boxer, clubId });
    clubIdsNeeded.add(clubId);
  }

  // Fetch club names
  const clubNames = new Map<string, string>();
  if (clubIdsNeeded.size > 0) {
    const clubRefs = Array.from(clubIdsNeeded).map((id) =>
      db.collection("clubs").doc(id)
    );
    const clubDocs = await db.getAll(...clubRefs);
    for (const doc of clubDocs) {
      if (doc.exists) {
        clubNames.set(doc.id, doc.data()?.name || "Unknown Club");
      }
    }
  }

  // Transform to search results
  for (const { boxer, clubId } of candidateData) {
    candidates.push({
      boxerId: boxer.boxerId,
      firstName: boxer.firstName,
      lastName: boxer.lastName,
      dob: boxer.dob,
      age: calculateAge(boxer.dob),
      gender: boxer.gender,
      category: boxer.category,
      declaredWeight: boxer.declaredWeight,
      declaredBouts: boxer.declaredBouts,
      declaredWins: boxer.declaredWins,
      declaredLosses: boxer.declaredLosses,
      availability: boxer.availability,
      clubId,
      clubName: clubNames.get(clubId) || "Unknown Club",
    });

    // Apply limit to reduce processing
    if (candidates.length >= limit * 2) break;
  }

  return candidates;
}

/**
 * Check rate limit for user
 */
async function checkRateLimit(
  db: admin.firestore.Firestore,
  userId: string
): Promise<void> {
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window

  const rateLimitRef = db.collection("rateLimits").doc(`findMatch:${userId}`);

  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(rateLimitRef);
    const data = doc.data() || { requests: [], lastCleanup: now };

    // Filter out old requests
    const recentRequests = (data.requests as number[]).filter(
      (ts: number) => ts > windowStart
    );

    if (recentRequests.length >= RATE_LIMIT_PER_MINUTE) {
      throw new functions.https.HttpsError(
        "resource-exhausted",
        `Rate limit exceeded. Maximum ${RATE_LIMIT_PER_MINUTE} requests per minute.`
      );
    }

    // Add current request
    recentRequests.push(now);

    transaction.set(rateLimitRef, {
      requests: recentRequests,
      lastCleanup: now,
    });
  });
}

/**
 * Get source boxer by ID, validating ownership
 */
async function getSourceBoxerById(
  db: admin.firestore.Firestore,
  boxerId: string,
  userClubIds: string[]
): Promise<BoxerSearchResult | null> {
  // Search for boxer in user's clubs
  for (const clubId of userClubIds) {
    const boxerDoc = await db
      .collection("clubs")
      .doc(clubId)
      .collection("boxers")
      .doc(boxerId)
      .get();

    if (boxerDoc.exists) {
      const boxer = boxerDoc.data() as Boxer;
      const clubDoc = await db.collection("clubs").doc(clubId).get();
      const clubName = clubDoc.data()?.name || "Unknown Club";

      return {
        boxerId: boxer.boxerId,
        firstName: boxer.firstName,
        lastName: boxer.lastName,
        dob: boxer.dob,
        age: calculateAge(boxer.dob),
        gender: boxer.gender,
        category: boxer.category,
        declaredWeight: boxer.declaredWeight,
        declaredBouts: boxer.declaredBouts,
        declaredWins: boxer.declaredWins,
        declaredLosses: boxer.declaredLosses,
        availability: boxer.availability,
        clubId,
        clubName,
      };
    }
  }

  return null;
}

// ═══════════════════════════════════════════
// MAIN FUNCTION
// ═══════════════════════════════════════════

/**
 * Find match callable function
 *
 * Parses natural language queries and returns compliant match candidates.
 *
 * @param data - FindMatchRequest
 * @param context - Call context with auth
 * @returns FindMatchResponse with matches and explanation
 */
export const findMatch = functions.https.onCall(
  async (data: FindMatchRequest, context): Promise<FindMatchResponse> => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated to find matches"
      );
    }

    const userId = context.auth.uid;
    const db = admin.firestore();

    // 2. Verify caller is a member of at least one club
    const userClubIds = await getUserClubIds(db, userId);

    if (userClubIds.length === 0) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You must be a member of at least one club to find matches"
      );
    }

    // 3. Check rate limit
    await checkRateLimit(db, userId);

    // 4. Validate request
    if (!data?.naturalLanguageQuery || data.naturalLanguageQuery.trim().length === 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "naturalLanguageQuery is required"
      );
    }

    const limit = Math.min(data.options?.limit || DEFAULT_LIMIT, MAX_LIMIT);
    const showDate = data.showDate
      ? new Date(data.showDate)
      : new Date();

    // 5. Parse intent (using regex parser, LLM integration in Task 5)
    let parsedIntent: ParsedMatchIntent;
    let sourceBoxer: BoxerSearchResult | null = null;

    if (data.boxerId) {
      // Explicit boxer ID provided - validate ownership
      sourceBoxer = await getSourceBoxerById(db, data.boxerId, userClubIds);

      if (!sourceBoxer) {
        throw new functions.https.HttpsError(
          "not-found",
          "Boxer not found in your club roster"
        );
      }

      parsedIntent = {
        sourceBoxerId: data.boxerId,
        sourceBoxerName: `${sourceBoxer.firstName} ${sourceBoxer.lastName}`,
        targetCriteria: {},
        showDate: showDate.toISOString().split("T")[0],
        confidence: "high",
        parserUsed: "regex",
      };
    } else {
      // Parse natural language query using LLM with regex fallback
      const userClubBoxers = await getUserClubBoxers(db, userClubIds);
      parsedIntent = await parseMatchIntentWithLLM(
        data.naturalLanguageQuery,
        userClubBoxers,
        userId
      );

      if (parsedIntent.error && !parsedIntent.sourceBoxerId) {
        // Could not identify boxer
        return {
          success: false,
          matches: [],
          explanation: parsedIntent.error,
          parsedIntent,
          sourceBoxer: null,
          total: 0,
          filtered: 0,
        };
      }

      // Get source boxer from parsed intent
      if (parsedIntent.sourceBoxerId) {
        sourceBoxer = userClubBoxers.find(
          (b) => b.boxerId === parsedIntent.sourceBoxerId
        ) || null;
      }

      if (!sourceBoxer) {
        return {
          success: false,
          matches: [],
          explanation: `Could not find boxer "${parsedIntent.sourceBoxerName}" in your club roster`,
          parsedIntent,
          sourceBoxer: null,
          total: 0,
          filtered: 0,
        };
      }
    }

    // 6. Search for candidates
    const candidates = await searchCandidates(
      db,
      sourceBoxer,
      userClubIds,
      limit * 3 // Fetch extra to allow for filtering
    );

    // 7. Apply compliance filtering and scoring
    const matchCandidates: MatchCandidate[] = [];
    let filteredCount = 0;

    for (const candidate of candidates) {
      const compliance = evaluateMatchCompliance(sourceBoxer, candidate, showDate);

      if (compliance.isCompliant) {
        matchCandidates.push({
          ...candidate,
          // Recalculate age at show date
          age: calculateAgeAtDate(candidate.dob, showDate),
          complianceScore: compliance.score,
          complianceNotes: generateComplianceNotes(compliance),
          compliance,
        });
      } else {
        filteredCount++;
      }
    }

    // 8. Sort by compliance score (highest first)
    matchCandidates.sort((a, b) => b.complianceScore - a.complianceScore);

    // 9. Apply limit
    const finalMatches = matchCandidates.slice(0, limit);

    // 10. Generate explanation using LLM with fallback
    let explanation: string;
    if (finalMatches.length === 0) {
      // No matches case (Task 4.12)
      explanation = buildNoMatchesExplanation(sourceBoxer, candidates.length, filteredCount);
    } else {
      // Use LLM for explanation generation with fallback to template
      const includeExplanation = data.options?.includeExplanation !== false;
      if (includeExplanation) {
        explanation = await generateMatchExplanation(
          sourceBoxer,
          finalMatches,
          data.naturalLanguageQuery,
          userId
        );
      } else {
        explanation = buildTemplateExplanation(
          sourceBoxer,
          finalMatches.length,
          parsedIntent.targetCriteria
        );
      }
    }

    functions.logger.info("Match search completed", {
      userId,
      sourceBoxerId: sourceBoxer.boxerId,
      totalCandidates: candidates.length,
      filtered: filteredCount,
      returned: finalMatches.length,
    });

    return {
      success: true,
      matches: finalMatches,
      explanation,
      parsedIntent,
      sourceBoxer,
      total: candidates.length,
      filtered: filteredCount,
    };
  }
);

/**
 * Build explanation when no matches found
 * Per front-end-spec.md §3.3 edge cases
 */
function buildNoMatchesExplanation(
  sourceBoxer: BoxerSearchResult,
  totalCandidates: number,
  filteredOut: number
): string {
  const parts: string[] = [];

  parts.push(
    `No compliant matches found for ${sourceBoxer.firstName} ${sourceBoxer.lastName}.`
  );

  if (totalCandidates === 0) {
    parts.push(
      `No ${sourceBoxer.gender} boxers in the ${sourceBoxer.category} category are currently listed as available.`
    );
    parts.push("Check back later as more clubs add their rosters.");
  } else if (filteredOut > 0) {
    parts.push(
      `Found ${totalCandidates} potential ${filteredOut === totalCandidates ? "candidates" : `candidates (${filteredOut} filtered for compliance)`}.`
    );
    parts.push("Matches were excluded due to:");
    parts.push("- Weight difference outside acceptable range");
    parts.push("- Experience level mismatch");
    parts.push("- Age requirements not met");
    parts.push(
      "Try adjusting your search criteria or check back as more boxers become available."
    );
  } else {
    parts.push("No suitable opponents match the compliance criteria at this time.");
  }

  return parts.join(" ");
}
