import { Timestamp } from "firebase-admin/firestore";

/**
 * Story 4.1 - Boxer & Roster Import TypeScript Interfaces
 *
 * Boxers are athletes belonging to exactly one club.
 * Roster imports track CSV upload processing.
 *
 * Invariants:
 * - Boxers belong to exactly one club
 * - boxerId is globally unique
 * - Age is NEVER stored (derived from DOB + show date)
 */

/**
 * Boxer data status lifecycle:
 * - draft: Created from CSV import, awaiting confirmation
 * - active: Confirmed and available for matchmaking
 * - archived: No longer active, retained for history
 */
export type BoxerDataStatus = "draft" | "active" | "archived";

/**
 * Boxer availability status:
 * - available: Ready for bouts
 * - unavailable: Temporarily not available
 * - injured: Cannot compete due to injury
 */
export type BoxerAvailability = "available" | "unavailable" | "injured";

/**
 * Boxer gender (England Boxing categories)
 */
export type BoxerGender = "male" | "female";

/**
 * Full Boxer document as stored in Firestore
 * Collection: clubs/{clubId}/boxers/{boxerId}
 *
 * [Source: Firebase implementation plan.md §1.2.2]
 */
export interface Boxer {
  boxerId: string;                // Globally unique
  firstName: string;
  lastName: string;
  dob: Timestamp;                 // Age NEVER stored, always derived
  gender: BoxerGender;
  category: string;               // e.g., 'junior', 'youth', 'elite'
  declaredWeight: number;         // kg
  declaredBouts: number;
  declaredWins: number;
  declaredLosses: number;
  dataStatus: BoxerDataStatus;
  availability: BoxerAvailability;
  notes: string | null;           // Club-only notes
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;              // userId
  lastModifiedBy: string;         // userId
}

/**
 * Roster import status lifecycle:
 * - pending: Import initiated, awaiting CSV upload
 * - processing: CSV uploaded, being parsed
 * - completed: Import finished successfully
 * - failed: Import failed (malformed CSV, etc.)
 */
export type RosterImportStatus = "pending" | "processing" | "completed" | "failed";

/**
 * Error entry for roster import
 * Records row-level validation failures
 */
export interface RosterImportError {
  row: number;
  message: string;
}

/**
 * Roster import document as stored in Firestore
 * Collection: clubs/{clubId}/rosterImports/{importId}
 *
 * [Source: Firebase implementation plan.md §1.2.3]
 */
export interface RosterImport {
  importId: string;
  fileName: string;
  storagePath: string;            // Cloud Storage reference
  status: RosterImportStatus;
  boxersCreated: number;
  errors: RosterImportError[];
  uploadedBy: string;             // userId
  uploadedAt: Timestamp;
  processedAt: Timestamp | null;
}

/**
 * Request for initiateRosterUpload callable function
 */
export interface InitiateRosterUploadRequest {
  clubId: string;
}

/**
 * Response from initiateRosterUpload callable function
 */
export interface InitiateRosterUploadResponse {
  importId: string;
  storagePath: string;
}

/**
 * CSV row structure for roster import
 * Maps to expected CSV columns
 */
export interface RosterCsvRow {
  firstName: string;
  lastName: string;
  dob: string;                    // Format: YYYY-MM-DD
  gender: string;
  category: string;
  declaredWeight: string;
  declaredBouts?: string;
  declaredWins?: string;
  declaredLosses?: string;
  availability?: string;
  notes?: string;
}

/**
 * Story 4.2 - Confirm Roster Types
 */

/**
 * Request for confirmRoster callable function
 * Explicit boxer selection required (no "confirm all" in MVP)
 */
export interface ConfirmRosterRequest {
  clubId: string;
  boxerIds: string[];  // Explicit selection of boxers to confirm
}

/**
 * Response from confirmRoster callable function
 */
export interface ConfirmRosterResponse {
  success: boolean;
  confirmedCount: number;
  boxerIds: string[];  // IDs of confirmed boxers
}

/**
 * Story 4.3 - Update Boxer Types
 */

/**
 * Editable boxer fields for update operations
 * Excludes immutable fields: boxerId, createdAt, createdBy
 * Excludes auto-set fields: updatedAt, lastModifiedBy
 */
export interface BoxerUpdates {
  firstName?: string;
  lastName?: string;
  dob?: string;  // ISO date string, converted to Timestamp
  gender?: BoxerGender;
  category?: string;
  declaredWeight?: number;
  declaredBouts?: number;
  declaredWins?: number;
  declaredLosses?: number;
  dataStatus?: BoxerDataStatus;
  availability?: BoxerAvailability;
  notes?: string | null;
}

/**
 * Request for updateBoxer callable function
 */
export interface UpdateBoxerRequest {
  clubId: string;
  boxerId: string;
  updates: BoxerUpdates;
}

/**
 * Response from updateBoxer callable function
 */
export interface UpdateBoxerResponse {
  success: boolean;
  boxer: Boxer;
}
