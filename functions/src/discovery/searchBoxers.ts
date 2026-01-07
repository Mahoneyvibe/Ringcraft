import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import {
  SearchBoxersRequest,
  SearchBoxersResponse,
  BoxerSearchResult,
} from "../types/discovery";
import { Boxer } from "../types/boxer";

/**
 * Story 5.1: Browse Other Clubs' Boxers
 *
 * Callable function for authenticated club members to search boxers
 * across all clubs for matchmaking purposes.
 *
 * Invariants:
 * - Only authenticated club members can search
 * - Notes field is NEVER exposed (club-private)
 * - Age is computed at runtime, never stored
 * - Only active boxers are returned
 */

// Constants
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;

/**
 * Calculate age from date of birth
 * Age is NEVER stored - always computed at runtime per architecture rules
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
  // Query all clubs where user is a member using collectionGroup
  const membershipQuery = await db
    .collectionGroup("members")
    .where("userId", "==", userId)
    .get();

  if (membershipQuery.empty) {
    return [];
  }

  // Extract club IDs from parent references
  const clubIds: string[] = [];
  for (const doc of membershipQuery.docs) {
    // Path is: clubs/{clubId}/members/{memberId}
    const clubId = doc.ref.parent.parent?.id;
    if (clubId) {
      clubIds.push(clubId);
    }
  }

  return clubIds;
}

/**
 * Fetch club names for a set of club IDs
 */
async function getClubNames(
  db: admin.firestore.Firestore,
  clubIds: Set<string>
): Promise<Map<string, string>> {
  const clubNames = new Map<string, string>();

  if (clubIds.size === 0) {
    return clubNames;
  }

  // Batch fetch club documents
  const clubRefs = Array.from(clubIds).map((id) => db.collection("clubs").doc(id));
  const clubDocs = await db.getAll(...clubRefs);

  for (const doc of clubDocs) {
    if (doc.exists) {
      const data = doc.data();
      clubNames.set(doc.id, data?.name || "Unknown Club");
    }
  }

  return clubNames;
}

/**
 * Convert Firestore boxer document to public-safe search result
 * Excludes notes and internal fields, computes age
 */
function toBoxerSearchResult(
  boxer: Boxer,
  clubId: string,
  clubName: string
): BoxerSearchResult {
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
    clubId: clubId,
    clubName: clubName,
  };
}

/**
 * Validate request parameters
 */
function validateRequest(data: SearchBoxersRequest): void {
  // Validate weight range if provided
  if (data.weightMin !== undefined) {
    if (typeof data.weightMin !== "number" || data.weightMin < 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "weightMin must be a non-negative number"
      );
    }
  }

  if (data.weightMax !== undefined) {
    if (typeof data.weightMax !== "number" || data.weightMax < 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "weightMax must be a non-negative number"
      );
    }
  }

  // Validate gender if provided
  if (data.gender !== undefined && !["male", "female"].includes(data.gender)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "gender must be 'male' or 'female'"
    );
  }

  // Validate availability if provided
  if (
    data.availability !== undefined &&
    !["available", "unavailable", "injured"].includes(data.availability)
  ) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "availability must be 'available', 'unavailable', or 'injured'"
    );
  }

  // Validate limit if provided
  if (data.limit !== undefined) {
    if (typeof data.limit !== "number" || data.limit < 1) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "limit must be a positive number"
      );
    }
  }

  // Validate offset if provided
  if (data.offset !== undefined) {
    if (typeof data.offset !== "number" || data.offset < 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "offset must be a non-negative number"
      );
    }
  }
}

/**
 * Callable function to search boxers across all clubs.
 *
 * Security: Requires authentication and club membership.
 *
 * Actions:
 * 1. Verify caller is authenticated
 * 2. Verify caller is a member of at least one club
 * 3. Query all active boxers using collection group query
 * 4. Apply filters (gender, category, weight range, availability)
 * 5. Exclude caller's own club boxers if requested
 * 6. Compute age for each boxer (never stored)
 * 7. Exclude notes field (club-private)
 * 8. Include club name in response
 * 9. Apply pagination (limit/offset)
 * 10. Return search results
 */
export const searchBoxers = functions.https.onCall(
  async (data: SearchBoxersRequest, context): Promise<SearchBoxersResponse> => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated to search boxers"
      );
    }

    const userId = context.auth.uid;
    const db = admin.firestore();

    // 2. Verify caller is a member of at least one club
    const userClubIds = await getUserClubIds(db, userId);

    if (userClubIds.length === 0) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You must be a member of at least one club to search boxers"
      );
    }

    // 3. Validate request parameters
    validateRequest(data || {});

    // Apply defaults
    const excludeOwnClub = data?.excludeOwnClub !== false; // Default: true
    const limit = Math.min(data?.limit || DEFAULT_LIMIT, MAX_LIMIT); // Cap at 100
    const offset = data?.offset || DEFAULT_OFFSET;

    // 4. Build query - start with collection group for all boxers
    let query: admin.firestore.Query = db.collectionGroup("boxers");

    // Always filter to active boxers only
    query = query.where("dataStatus", "==", "active");

    // Apply optional filters
    if (data?.gender) {
      query = query.where("gender", "==", data.gender);
    }

    if (data?.category) {
      query = query.where("category", "==", data.category);
    }

    if (data?.availability) {
      query = query.where("availability", "==", data.availability);
    }

    // Note: Weight range filtering must be done in-memory
    // Firestore doesn't support range queries on different fields in same query

    // 5. Execute query
    const snapshot = await query.get();

    // 6. Process results - filter and transform
    const allBoxers: { boxer: Boxer; clubId: string }[] = [];
    const clubIdsNeeded = new Set<string>();

    for (const doc of snapshot.docs) {
      // Extract club ID from document path: clubs/{clubId}/boxers/{boxerId}
      const clubId = doc.ref.parent.parent?.id;
      if (!clubId) continue;

      // Skip own club boxers if flag is true
      if (excludeOwnClub && userClubIds.includes(clubId)) {
        continue;
      }

      const boxer = doc.data() as Boxer;

      // Apply weight range filter (in-memory)
      if (data?.weightMin !== undefined && boxer.declaredWeight < data.weightMin) {
        continue;
      }
      if (data?.weightMax !== undefined && boxer.declaredWeight > data.weightMax) {
        continue;
      }

      allBoxers.push({ boxer, clubId });
      clubIdsNeeded.add(clubId);
    }

    // 7. Fetch club names
    const clubNames = await getClubNames(db, clubIdsNeeded);

    // 8. Apply pagination
    const total = allBoxers.length;
    const paginatedBoxers = allBoxers.slice(offset, offset + limit);
    const hasMore = offset + limit < total;

    // 9. Transform to search results (excludes notes, computes age)
    const results: BoxerSearchResult[] = paginatedBoxers.map(({ boxer, clubId }) =>
      toBoxerSearchResult(boxer, clubId, clubNames.get(clubId) || "Unknown Club")
    );

    functions.logger.info("Boxer search completed", {
      userId,
      totalResults: total,
      returnedResults: results.length,
      filters: {
        gender: data?.gender,
        category: data?.category,
        weightMin: data?.weightMin,
        weightMax: data?.weightMax,
        availability: data?.availability,
        excludeOwnClub,
      },
    });

    return {
      success: true,
      boxers: results,
      total,
      hasMore,
    };
  }
);
