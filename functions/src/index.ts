/**
 * FirstBell Cloud Functions
 *
 * This file exports all Cloud Functions for the FirstBell platform.
 * Functions own all state transitions for proposals, bouts, slots, and tokens.
 *
 * Architecture invariants (from Architecture v1 Section 12):
 * - Cloud Functions own state transitions
 * - Clients never directly mutate proposal, bout, slot, or token state
 * - All admin actions are audited
 * - Deep links are resolved only via Cloud Functions
 */

import * as admin from "firebase-admin";
import * as functions from "firebase-functions";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export Firestore and Auth references for use in function modules
export const db = admin.firestore();
export const auth = admin.auth();

// ═══════════════════════════════════════════
// AUTH TRIGGERS (Story 1.1)
// ═══════════════════════════════════════════
export { onUserCreate } from "./auth/onUserCreate";

// ═══════════════════════════════════════════
// ADMIN FUNCTIONS (Story 1.2)
// ═══════════════════════════════════════════
export { setAdminClaim } from "./admin/setAdminClaim";

// ═══════════════════════════════════════════
// CLUB FUNCTIONS (Story 2.1, 2.2, 3.2)
// ═══════════════════════════════════════════
export { searchClubs } from "./clubs/searchClubs";
export { claimClub } from "./clubs/claimClub";
export { approveClubClaim } from "./clubs/approveClubClaim";
export { rejectClubClaim } from "./clubs/rejectClubClaim";
export { getClubMembers } from "./clubs/getClubMembers";

// ═══════════════════════════════════════════
// ROSTER FUNCTIONS (Story 4.1, 4.2, 4.3)
// ═══════════════════════════════════════════
export { processRosterUpload } from "./roster/processRosterUpload";
export { initiateRosterUpload } from "./roster/initiateRosterUpload";
export { confirmRoster } from "./roster/confirmRoster";
export { updateBoxer } from "./roster/updateBoxer";

/**
 * Helper: Check if the proposal system is paused
 * Required in: createProposal, respondToProposal
 * Implementation Plan §2.3
 */
export async function checkKillSwitch(): Promise<void> {
  const settings = await db.doc("admin/settings").get();
  if (settings.data()?.proposalKillSwitch) {
    throw new functions.https.HttpsError(
      "unavailable",
      "Proposal system is temporarily paused"
    );
  }
}

/**
 * Function stubs - to be implemented in later phases
 *
 * Phase 2: Club Claim Flow
 * - claimClub
 * - approveClubClaim
 * - rejectClubClaim
 *
 * Phase 3: Roster & Boxer Management
 * - processRosterUpload (Storage trigger) ✓
 * - confirmRoster ✓
 * - updateBoxer ✓
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
