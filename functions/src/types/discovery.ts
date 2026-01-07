import { Timestamp } from "firebase-admin/firestore";
import { BoxerAvailability, BoxerGender } from "./boxer";

/**
 * Story 5.1 - Browse Other Clubs' Boxers
 *
 * Types for boxer discovery/search functionality.
 * Enables cross-club boxer search for matchmaking.
 *
 * Invariants:
 * - Notes field is NEVER included (club-private)
 * - Age is computed at runtime, never stored
 * - Only authenticated club members can search
 */

/**
 * Request for searchBoxers callable function
 *
 * All filters are optional. When not provided:
 * - All active boxers across all clubs are returned (paginated)
 * - excludeOwnClub defaults to true
 */
export interface SearchBoxersRequest {
  // Filters (all optional)
  gender?: BoxerGender;
  category?: string;
  weightMin?: number;
  weightMax?: number;
  availability?: BoxerAvailability;
  excludeOwnClub?: boolean; // Default: true

  // Pagination
  limit?: number; // Default: 20, max: 100
  offset?: number; // Default: 0
}

/**
 * Response from searchBoxers callable function
 */
export interface SearchBoxersResponse {
  success: boolean;
  boxers: BoxerSearchResult[];
  total: number; // Total matching (for pagination UI)
  hasMore: boolean;
}

/**
 * Public-safe boxer data for search results
 *
 * Excludes:
 * - notes (club-private)
 * - createdAt, updatedAt (internal)
 * - createdBy, lastModifiedBy (internal)
 * - dataStatus (always 'active' in results)
 */
export interface BoxerSearchResult {
  boxerId: string;
  firstName: string;
  lastName: string;
  dob: Timestamp;
  age: number; // DERIVED at query time, never stored
  gender: BoxerGender;
  category: string;
  declaredWeight: number;
  declaredBouts: number;
  declaredWins: number;
  declaredLosses: number;
  availability: BoxerAvailability;
  clubId: string;
  clubName: string; // Denormalized for display
}
