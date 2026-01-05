import { Timestamp } from "firebase-admin/firestore";

/**
 * Story 2.1 - Club TypeScript Interface
 *
 * Clubs are pre-seeded entities representing UK amateur boxing clubs.
 * Club officials can claim their club to become club admins.
 *
 * Invariant: Clubs are never deleted.
 */

/**
 * Club status lifecycle:
 * - unclaimed: Initial state, awaiting club official to claim
 * - claim_pending: Claim submitted, awaiting platform admin approval
 * - claimed: Active club with verified ownership
 * - suspended: Temporarily disabled by platform admin
 */
export type ClubStatus = "unclaimed" | "claim_pending" | "claimed" | "suspended";

/**
 * Full Club document as stored in Firestore
 * Collection: clubs/{clubId}
 */
export interface Club {
  clubId: string;
  name: string;
  region: string;
  status: ClubStatus;
  claimedBy: string | null;       // userId who claimed
  claimedAt: Timestamp | null;
  contactEmail: string | null;
  contactPhone: string | null;    // NEVER exposed publicly
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Public club data returned by searchClubs
 * Excludes sensitive fields: contactPhone
 */
export interface ClubSearchResult {
  clubId: string;
  name: string;
  region: string;
  status: ClubStatus;
}

/**
 * Parameters for searchClubs callable function
 */
export interface SearchClubsRequest {
  query?: string;       // Search term for name matching
  region?: string;      // Filter by region
}

/**
 * Response from searchClubs callable function
 */
export interface SearchClubsResponse {
  clubs: ClubSearchResult[];
  total: number;
}
