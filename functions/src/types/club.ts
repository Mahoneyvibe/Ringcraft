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

/**
 * Story 2.2 - Club Member Interface
 *
 * Club members are users associated with a club.
 * Created when a club claim is approved.
 *
 * Collection: clubs/{clubId}/members/{userId}
 */

/**
 * Club member roles (descriptive only - not enforced in security rules at MVP)
 */
export type ClubMemberRole = "chair" | "coach" | "matchmaker" | "secretary";

/**
 * Club member document as stored in Firestore
 * Subcollection: clubs/{clubId}/members/{userId}
 */
export interface ClubMember {
  userId: string;
  displayName: string;          // Denormalized from user
  photoURL: string | null;      // Denormalized from user (profile photo)
  role: ClubMemberRole;         // Descriptive only at MVP
  joinedAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Story 3.2 - Get Club Members Request/Response
 *
 * Callable function interfaces for retrieving club member list.
 */

/**
 * Parameters for getClubMembers callable function
 */
export interface GetClubMembersRequest {
  clubId: string;
}

/**
 * Public-facing member data returned by getClubMembers
 * Excludes sensitive fields, includes only display-relevant data
 */
export interface ClubMemberListItem {
  userId: string;
  displayName: string;
  photoURL: string | null;
  role: ClubMemberRole;
  joinedAt: Timestamp;
}

/**
 * Response from getClubMembers callable function
 */
export interface GetClubMembersResponse {
  members: ClubMemberListItem[];
  total: number;
}
