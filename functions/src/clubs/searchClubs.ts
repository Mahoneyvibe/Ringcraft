import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {
  Club,
  ClubSearchResult,
  SearchClubsRequest,
  SearchClubsResponse,
} from "../types/club";

/**
 * Story 2.1: Pre-Seeded Club Directory
 *
 * Callable function to search for clubs by name and/or region.
 * Returns public club data only (excludes contactPhone).
 *
 * MVP Approach: Given the limited number of clubs (~200-500),
 * we fetch clubs and filter in-memory. For future scale,
 * consider Algolia or Typesense for full-text search.
 */

/**
 * Transform Club document to ClubSearchResult (excludes sensitive fields)
 */
function toSearchResult(club: Club): ClubSearchResult {
  return {
    clubId: club.clubId,
    name: club.name,
    region: club.region,
    status: club.status,
  };
}

/**
 * Case-insensitive partial match for name search
 */
function matchesQuery(name: string, query: string): boolean {
  return name.toLowerCase().includes(query.toLowerCase());
}

/**
 * Callable function to search clubs.
 *
 * Security: Requires authentication.
 * Privacy: Never returns contactPhone.
 *
 * @param data.query - Optional search term for name matching
 * @param data.region - Optional region filter (exact match)
 * @returns List of matching clubs (public fields only)
 */
export const searchClubs = functions.https.onCall(
  async (data: SearchClubsRequest, context): Promise<SearchClubsResponse> => {
    // 1. Verify caller is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "Must be authenticated to search clubs"
      );
    }

    const { query, region } = data || {};

    functions.logger.info("Club search requested", {
      userId: context.auth.uid,
      query: query || "(none)",
      region: region || "(none)",
    });

    try {
      const db = admin.firestore();
      let clubsQuery: admin.firestore.Query = db.collection("clubs");

      // Apply region filter at query level if specified
      if (region && typeof region === "string" && region.trim()) {
        clubsQuery = clubsQuery.where("region", "==", region.trim());
      }

      const snapshot = await clubsQuery.get();

      let clubs: ClubSearchResult[] = snapshot.docs.map((doc) => {
        const clubData = doc.data() as Club;
        return toSearchResult(clubData);
      });

      // Apply name filter in-memory (MVP approach for partial matching)
      if (query && typeof query === "string" && query.trim()) {
        const searchTerm = query.trim();
        clubs = clubs.filter((club) => matchesQuery(club.name, searchTerm));
      }

      functions.logger.info("Club search completed", {
        userId: context.auth.uid,
        resultsCount: clubs.length,
      });

      return {
        clubs,
        total: clubs.length,
      };
    } catch (error) {
      functions.logger.error("Club search failed", { error });
      throw new functions.https.HttpsError(
        "internal",
        "Failed to search clubs"
      );
    }
  }
);
