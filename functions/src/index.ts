/**
 * Ringcraft Cloud Functions
 *
 * This file exports all Cloud Functions for the Ringcraft platform.
 * Functions own all state transitions for proposals, bouts, slots, and tokens.
 *
 * Architecture invariants (from Architecture v1 Section 12):
 * - Cloud Functions own state transitions
 * - Clients never directly mutate proposal, bout, slot, or token state
 * - All admin actions are audited
 * - Deep links are resolved only via Cloud Functions
 */

import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export Firestore and Auth references for use in function modules
export const db = admin.firestore();
export const auth = admin.auth();

/**
 * Function stubs - to be implemented in later phases
 *
 * Phase 2: Club Claim Flow
 * - claimClub
 * - approveClubClaim
 * - rejectClubClaim
 *
 * Phase 3: Roster & Boxer Management
 * - processRosterUpload (Storage trigger)
 * - confirmRoster
 *
 * Phase 4: Discovery & Matchmaking
 * - (client-side queries with runtime filtering)
 *
 * Phase 5: Proposals & Deep Links
 * - createProposal
 * - respondToProposal
 * - withdrawProposal
 * - expireProposals (scheduled)
 *
 * Phase 6: Shows & Slots
 * - createShow
 * - updateSlotStatus (internal)
 *
 * Phase 7: Admin & Safety Controls
 * - adminVoidBout
 * - adminSuspendClub
 * - adminPauseProposals
 */
