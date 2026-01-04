Firebase Implementation Plan (v1)

Status: Approved for Phase 0–1 execution    
Derived from: Ringcraft Architecture v1    
Authority: Execution reference (must not violate architecture or PRD)

  1\. Firestore Collections & Subcollections

  1.1 users (Top-Level)

  users/{userId}  
  ├── uid: string                    \# Firebase Auth UID  
  ├── email: string  
  ├── displayName: string  
  ├── photoURL: string | null  
  ├── createdAt: timestamp  
  ├── updatedAt: timestamp  
  └── clubMemberships: string\[\]      \# Array of clubIds (denormalized for queries)

  1.2 clubs (Top-Level, Pre-Seeded)

  clubs/{clubId}  
  ├── name: string  
  ├── region: string  
  ├── status: 'unclaimed' | 'claim\_pending' | 'claimed' | 'suspended'  
  ├── claimedBy: string | null       \# userId who claimed  
  ├── claimedAt: timestamp | null  
  ├── contactEmail: string | null  
  ├── contactPhone: string | null    \# Never exposed publicly  
  ├── createdAt: timestamp  
  └── updatedAt: timestamp  
  Invariant: Clubs are never deleted.

  1.2.1 clubs/{clubId}/members (Subcollection)

  clubs/{clubId}/members/{userId}  
  ├── userId: string  
  ├── displayName: string            \# Denormalized  
  ├── role: string                   \# 'coach' | 'matchmaker' | 'secretary' | 'chair' (descriptive only)  
  ├── joinedAt: timestamp  
  └── updatedAt: timestamp  
  Note: Flat permissions at MVP — role is descriptive, not enforced.

  1.2.2 clubs/{clubId}/boxers (Subcollection)

  clubs/{clubId}/boxers/{boxerId}  
  ├── boxerId: string                \# Globally unique  
  ├── firstName: string  
  ├── lastName: string  
  ├── dob: timestamp                 \# Age NEVER stored, always derived  
  ├── gender: 'male' | 'female'  
  ├── category: string               \# e.g., 'junior', 'youth', 'elite'  
  ├── declaredWeight: number         \# kg  
  ├── declaredBouts: number  
  ├── declaredWins: number  
  ├── declaredLosses: number  
  ├── dataStatus: 'draft' | 'active' | 'archived'  
  ├── availability: 'available' | 'unavailable' | 'injured'  
  ├── notes: string | null           \# Club-only notes  
  ├── createdAt: timestamp  
  ├── updatedAt: timestamp  
  ├── createdBy: string              \# userId  
  └── lastModifiedBy: string         \# userId  
  Invariant: Boxers belong to exactly one club. boxerId is globally unique.

  1.2.3 clubs/{clubId}/rosterImports (Subcollection)

  clubs/{clubId}/rosterImports/{importId}  
  ├── importId: string  
  ├── fileName: string  
  ├── storagePath: string            \# Cloud Storage reference  
  ├── status: 'pending' | 'processing' | 'completed' | 'failed'  
  ├── boxersCreated: number  
  ├── errors: array\<{row: number, message: string}\>  
  ├── uploadedBy: string             \# userId  
  ├── uploadedAt: timestamp  
  └── processedAt: timestamp | null

  1.3 shows (Top-Level)

  shows/{showId}  
  ├── hostClubId: string  
  ├── hostClubName: string           \# Denormalized  
  ├── title: string  
  ├── date: timestamp  
  ├── venue: {  
  │     name: string  
  │     address: string              \# Full address, public when published  
  │     postcode: string  
  │   }  
  ├── weighInStart: timestamp  
  ├── weighInEnd: timestamp  
  ├── boxingStart: timestamp  
  ├── status: 'draft' | 'published' | 'completed' | 'cancelled' | 'hidden'  
  ├── createdAt: timestamp  
  ├── updatedAt: timestamp  
  ├── createdBy: string  
  └── lastModifiedBy: string

  1.3.1 shows/{showId}/slots (Subcollection)

  shows/{showId}/slots/{slotId}  
  ├── slotId: string  
  ├── position: number               \# Order on card  
  ├── category: string  
  ├── targetWeight: number  
  ├── targetGender: 'male' | 'female'  
  ├── targetExperienceMin: number | null  
  ├── targetExperienceMax: number | null  
  ├── homeBoxerId: string | null     \# If host club is providing boxer  
  ├── homeBoxerSnapshot: object | null  
  ├── status: 'open' | 'proposed' | 'secured' | 'closed'  
  ├── securedBoutId: string | null  
  ├── createdAt: timestamp  
  └── updatedAt: timestamp  
  Invariant: Slot status transitions only via Cloud Functions.

  1.4 proposals (Top-Level)

  proposals/{proposalId}  
  ├── proposalId: string  
  ├── fromClubId: string  
  ├── fromClubName: string           \# Denormalized  
  ├── toClubId: string  
  ├── toClubName: string             \# Denormalized  
  ├── showId: string  
  ├── slotId: string  
  ├── showDate: timestamp            \# Denormalized for filtering  
  │  
  ├── proposedBoxerSnapshot: {       \# IMMUTABLE at creation  
  │     boxerId: string  
  │     firstName: string  
  │     lastName: string  
  │     dob: timestamp  
  │     gender: string  
  │     category: string  
  │     declaredWeight: number  
  │     declaredBouts: number  
  │     declaredWins: number  
  │     declaredLosses: number  
  │     clubId: string  
  │     clubName: string  
  │     snapshotAt: timestamp  
  │   }  
  │  
  ├── targetBoxerSnapshot: object | null  \# If specific boxer targeted  
  │  
  ├── status: 'proposed' | 'accepted' | 'declined' | 'expired' | 'withdrawn' | 'voided'  
  ├── statusReason: string | null  
  ├── respondedAt: timestamp | null  
  ├── respondedBy: string | null     \# userId or 'deeplink'  
  │  
  ├── deeplinkTokenId: string | null  
  ├── expiresAt: timestamp  
  ├── createdAt: timestamp  
  ├── createdBy: string  
  └── updatedAt: timestamp  
  Invariant: Clients cannot write to status. Boxer snapshots are immutable.

  1.5 bouts (Top-Level)

  bouts/{boutId}
  ├── boutId: string
  ├── proposalId: string             \# Source proposal
  ├── showId: string
  ├── slotId: string
  ├── showDate: timestamp
  │
  ├── redCorner: {                   \# Immutable snapshot
  │     boxerId: string
  │     firstName: string
  │     lastName: string
  │     dob: timestamp
  │     clubId: string
  │     clubName: string
  │     declaredWeight: number
  │     declaredBouts: number
  │   }
  │
  ├── blueCorner: {                  \# Immutable snapshot
  │     boxerId: string
  │     firstName: string
  │     lastName: string
  │     dob: timestamp
  │     clubId: string
  │     clubName: string
  │     declaredWeight: number
  │     declaredBouts: number
  │   }
  │
  ├── status: 'agreed' | 'completed' | 'did_not_happen' | 'cancelled'
  ├── statusReason: string | null
  │
  ├── result: {                      \# Populated on completion
  │     winnerId: string             \# boxerId of winner
  │     loserId: string              \# boxerId of loser
  │     recordedBy: string           \# userId who recorded
  │     recordedAt: timestamp
  │     lastEditedBy: string | null  \# userId if corrected
  │     lastEditedAt: timestamp | null
  │   } | null
  │
  ├── createdAt: timestamp
  └── updatedAt: timestamp

  Invariants:
  - Clients cannot write to bouts. All mutations via Cloud Functions only.
  - Created on proposal acceptance with status 'agreed'.
  - Result can only be recorded after showDate has passed.
  - Hosting club may correct result within 7 days of recordedAt.
  - After 7 days, only platform admin can correct.

  1.6 deeplinkTokens (Top-Level)

  deeplinkTokens/{tokenId}  
  ├── tokenId: string                \# Secure random  
  ├── proposalId: string  
  ├── targetClubId: string           \# Club authorized to respond  
  ├── action: 'respond'              \# Extensible for future actions  
  ├── status: 'active' | 'consumed' | 'expired' | 'revoked'  
  ├── consumedAt: timestamp | null  
  ├── expiresAt: timestamp  
  ├── createdAt: timestamp  
  └── createdBy: string  
  Invariant: Tokens are single-use, time-bound, club-bound. Resolved via Cloud Function only.

  1.7 admin/settings (Single Document)

  admin/settings  
  ├── proposalKillSwitch: boolean    \# Pause all outbound proposals  
  ├── maintenanceMode: boolean  
  ├── maintenanceMessage: string | null  
  └── updatedAt: timestamp

  1.8 admin/auditLogs/{logId} (Subcollection)

  admin/auditLogs/{logId}  
  ├── logId: string  
  ├── action: string                 \# e.g., 'club.claim.approved', 'bout.voided'  
  ├── actorId: string                \# userId or 'system'  
  ├── actorType: 'user' | 'admin' | 'system' | 'deeplink'  
  ├── targetType: string             \# 'club' | 'boxer' | 'proposal' | 'bout' | etc.  
  ├── targetId: string  
  ├── targetClubId: string | null  
  ├── details: object                \# Action-specific data  
  ├── timestamp: timestamp  
  └── ipAddress: string | null       \# For admin actions  
  Invariant: Audit logs are append-only and immutable. No updates or deletes.

  \---  
  2\. Cloud Function Boundaries & Responsibilities

  2.1 Function Ownership Matrix

  | Function            | Trigger            | Responsibility                            | Writes To                                          |  
  |---------------------|--------------------|-------------------------------------------|----------------------------------------------------|  
  | claimClub           | HTTPS Callable     | Validate claim request, set claim\_pending | clubs, auditLogs                                   |  
  | approveClubClaim    | HTTPS Callable     | Admin approves claim, add member          | clubs, members, users, auditLogs                   |  
  | rejectClubClaim     | HTTPS Callable     | Admin rejects claim                       | clubs, auditLogs                                   |  
  | processRosterUpload | Storage Trigger    | Parse CSV, create draft boxers            | boxers, rosterImports, auditLogs                   |  
  | confirmRoster       | HTTPS Callable     | Activate draft boxers                     | boxers, auditLogs                                  |  
  | createProposal      | HTTPS Callable     | Validate, snapshot boxer, create token    | proposals, deeplinkTokens, slots, auditLogs        |  
  | respondToProposal   | HTTPS Callable     | Deep-link response handler                | proposals, bouts, slots, deeplinkTokens, auditLogs |  
  | withdrawProposal    | HTTPS Callable     | Sender withdraws                          | proposals, slots, auditLogs                        |  
  | expireProposals     | Scheduled (hourly) | Mark expired proposals                    | proposals, slots, deeplinkTokens                   |  
  | createShow          | HTTPS Callable     | Validate host club, create show           | shows, auditLogs                                   |  
  | updateSlotStatus    | Internal Only      | Atomic slot state transitions             | slots                                              |  
  | adminVoidBout       | HTTPS Callable     | Admin voids a bout                        | bouts, slots, auditLogs                            |
  | adminSuspendClub    | HTTPS Callable     | Admin suspends club                       | clubs, auditLogs                                   |
  | adminPauseProposals | HTTPS Callable     | Toggle kill switch                        | admin/settings, auditLogs                          |
  | recordBoutResult    | HTTPS Callable     | Host club records W/L result              | bouts, boxers (W/L counters), auditLogs            |
  | correctBoutResult   | HTTPS Callable     | Host club or admin corrects result        | bouts, boxers (W/L counters), auditLogs            |
  | markBoutDidNotHappen| HTTPS Callable     | Mark bout as did not take place           | bouts, auditLogs                                   |

  2.2 State Transition Rules (Cloud Functions Only)

  Club Lifecycle:  
  unclaimed ──\[claimClub\]──► claim\_pending ──\[approveClubClaim\]──► claimed  
                                           ──\[rejectClubClaim\]──► unclaimed  
  claimed ──\[adminSuspendClub\]──► suspended  
  suspended ──\[adminReinstateClub\]──► claimed

  Boxer Data Status:  
  (CSV upload) ──\[processRosterUpload\]──► draft ──\[confirmRoster\]──► active  
  active ──\[archiveBoxer\]──► archived

  Slot Lifecycle:  
  open ──\[createProposal\]──► proposed ──\[respondToProposal:accept\]──► secured  
                                      ──\[respondToProposal:decline\]──► open  
                                      ──\[expireProposals\]──► open  
  secured ──\[adminVoidBout\]──► open

  Proposal Lifecycle:
  proposed ──[respondToProposal:accept]──► accepted
           ──[respondToProposal:decline]──► declined
           ──[withdrawProposal]──► withdrawn
           ──[expireProposals]──► expired
           ──[adminVoidProposal]──► voided

  Bout Lifecycle:
  (created on proposal acceptance)
  agreed ──[recordBoutResult]──► completed
         ──[markBoutDidNotHappen]──► did_not_happen
         ──[adminVoidBout]──► cancelled

  Result Correction Flow:
  completed ──[correctBoutResult within 7 days]──► completed (result updated, counters adjusted)
  completed ──[correctBoutResult by admin]──► completed (no time restriction)

  Note: On recordBoutResult, the following boxer fields are atomically updated:
  - Winner: declaredWins += 1, declaredBouts += 1
  - Loser: declaredLosses += 1, declaredBouts += 1
  On correctBoutResult, previous increments are reversed before applying new result.

  2.3 Kill Switch Check (Required in Functions)

  // Required at start of: createProposal, respondToProposal  
  async function checkKillSwitch(): Promise\<void\> {  
    const settings \= await db.doc('admin/settings').get();  
    if (settings.data()?.proposalKillSwitch) {  
      throw new functions.https.HttpsError(  
        'unavailable',  
        'Proposal system is temporarily paused'  
      );  
    }  
  }

  \---  
  3\. Auth Model & Custom Claims

  3.1 Firebase Auth Configuration

  \- Providers: Email/Password (MVP)  
  \- Email verification: Required before club claim  
  \- Session: Firebase Auth tokens (1 hour, auto-refresh)

  3.2 Custom Claims Structure

  interface CustomClaims {  
    isPlatformAdmin?: boolean;       // Platform admin access  
    // Club membership NOT in claims (read from Firestore)  
  }

  Setting admin claim (admin SDK only):  
  await admin.auth().setCustomUserClaims(uid, { isPlatformAdmin: true });

  3.3 Auth State Requirements

  | Action                | Auth Required | Additional Check       |  
  |-----------------------|---------------|------------------------|  
  | View shows feed       | Yes           | None                   |  
  | View boxer discovery  | Yes           | Active club membership |  
  | Manage club roster    | Yes           | Member of target club  |  
  | Create proposal       | Yes           | Member of sending club |  
  | Respond via deep link | No            | Valid token only       |  
  | Admin actions         | Yes           | isPlatformAdmin: true  |

  \---  
  4\. Security Rules Ownership Model

  4.1 Core Principles

  rules\_version \= '2';  
  service cloud.firestore {  
    match /databases/{database}/documents {

      // ═══════════════════════════════════════════  
      // HELPER FUNCTIONS  
      // ═══════════════════════════════════════════

      function isAuthenticated() {  
        return request.auth \!= null;  
      }

      function isPlatformAdmin() {  
        return isAuthenticated() &&  
               request.auth.token.isPlatformAdmin \== true;  
      }

      function isClubMember(clubId) {  
        return isAuthenticated() &&  
               exists(/databases/$(database)/documents/clubs/$(clubId)/members/$(request.auth.uid));  
      }

      function isAnyClubMember() {  
        return isAuthenticated() &&  
               get(/databases/$(database)/documents/users/$(request.auth.uid)).data.clubMemberships.size() \> 0;  
      }

  4.2 Collection Rules

      // ═══════════════════════════════════════════  
      // USERS  
      // ═══════════════════════════════════════════  
      match /users/{userId} {  
        allow read: if isAuthenticated();  
        allow create: if isAuthenticated() && request.auth.uid \== userId;  
        allow update: if request.auth.uid \== userId || isPlatformAdmin();  
        allow delete: if false;  // Never delete users  
      }

      // ═══════════════════════════════════════════  
      // CLUBS  
      // ═══════════════════════════════════════════  
      match /clubs/{clubId} {  
        allow read: if isAuthenticated();  
        allow create: if false;  // Pre-seeded only  
        allow update: if false;  // Cloud Functions only  
        allow delete: if false;  // Clubs never deleted

        // Members subcollection  
        match /members/{memberId} {  
          allow read: if isAuthenticated();  
          allow write: if false;  // Cloud Functions only  
        }

        // Boxers subcollection  
        match /boxers/{boxerId} {  
          allow read: if isAnyClubMember();  // Cross-club discovery  
          allow create: if isClubMember(clubId);  
          allow update: if isClubMember(clubId) &&  
                          request.resource.data.boxerId \== resource.data.boxerId;  // boxerId immutable  
          allow delete: if false;  // Archive, never delete  
        }

        // Roster imports subcollection  
        match /rosterImports/{importId} {  
          allow read: if isClubMember(clubId);  
          allow create: if isClubMember(clubId);  
          allow update: if false;  // Cloud Functions only  
          allow delete: if false;  
        }  
      }

      // ═══════════════════════════════════════════  
      // SHOWS  
      // ═══════════════════════════════════════════  
      match /shows/{showId} {  
        allow read: if isAuthenticated();  
        allow create: if isClubMember(request.resource.data.hostClubId);  
        allow update: if isClubMember(resource.data.hostClubId) &&  
                        request.resource.data.hostClubId \== resource.data.hostClubId;  
        allow delete: if false;

        match /slots/{slotId} {  
          allow read: if isAuthenticated();  
          allow create: if isClubMember(get(/databases/$(database)/documents/shows/$(showId)).data.hostClubId);  
          allow update: if false;  // Cloud Functions only (state transitions)  
          allow delete: if false;  
        }  
      }

      // ═══════════════════════════════════════════  
      // PROPOSALS \- Cloud Functions Only  
      // ═══════════════════════════════════════════  
      match /proposals/{proposalId} {  
        allow read: if isAuthenticated() && (  
                      resource.data.fromClubId in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.clubMemberships ||  
                      resource.data.toClubId in get(/databases/$(database)/documents/users/$(request.auth.uid)).data.clubMemberships ||  
                      isPlatformAdmin()  
                    );  
        allow write: if false;  // Cloud Functions only  
      }

      // ═══════════════════════════════════════════  
      // BOUTS \- Cloud Functions Only  
      // ═══════════════════════════════════════════  
      match /bouts/{boutId} {  
        allow read: if isAuthenticated();  
        allow write: if false;  // Cloud Functions only  
      }

      // ═══════════════════════════════════════════  
      // DEEPLINK TOKENS \- Cloud Functions Only  
      // ═══════════════════════════════════════════  
      match /deeplinkTokens/{tokenId} {  
        allow read: if false;   // Never exposed to clients  
        allow write: if false;  // Cloud Functions only  
      }

      // ═══════════════════════════════════════════  
      // ADMIN \- Platform Admin Only  
      // ═══════════════════════════════════════════  
      match /admin/settings {  
        allow read: if isAuthenticated();  // Kill switch status visible  
        allow write: if false;  // Cloud Functions only  
      }

      match /admin/auditLogs/{logId} {  
        allow read: if isPlatformAdmin();  
        allow create: if false;  // Cloud Functions only  
        allow update: if false;  // Immutable  
        allow delete: if false;  // Immutable  
      }  
    }  
  }

  4.3 Ownership Summary

  | Collection            | Read                   | Write                | Owner     |  
  |-----------------------|------------------------|----------------------|-----------|  
  | users                 | Authenticated          | Self or Admin        | User      |  
  | clubs                 | Authenticated          | None (CF only)       | System    |  
  | clubs/\*/members       | Authenticated          | None (CF only)       | System    |  
  | clubs/\*/boxers        | Any club member        | Owning club          | Club      |  
  | clubs/\*/rosterImports | Owning club            | Owning club (create) | Club      |  
  | shows                 | Authenticated          | Host club            | Host Club |  
  | shows/\*/slots         | Authenticated          | None (CF only)       | System    |  
  | proposals             | Involved clubs \+ Admin | None (CF only)       | System    |  
  | bouts                 | Authenticated          | None (CF only)       | System    |  
  | deeplinkTokens        | None                   | None (CF only)       | System    |  
  | admin/settings        | Authenticated          | None (CF only)       | System    |  
  | admin/auditLogs       | Admin only             | None (CF only)       | System    |

  \---  
  5\. Invariant Compliance Checklist

  | Invariant                                          | Implementation                                       |  
  |----------------------------------------------------|------------------------------------------------------|  
  | Age never stored                                   | dob stored; age computed client-side or in CF        |  
  | Derived data never persisted                       | No age, isEligible, or computed fields               |  
  | Clubs never deleted                                | Security rules: allow delete: if false               |  
  | Audit logs immutable                               | Security rules: no update/delete                     |  
  | Clients cannot mutate proposals/bouts/slots/tokens | Security rules: allow write: if false                |  
  | Deep links resolved via CF only                    | deeplinkTokens not readable by clients               |  
  | Admin via custom claim                             | isPlatformAdmin claim, separate from club membership |  
  | Boxer snapshots immutable                          | Stored at proposal creation, never updated           |
  | Dev/prod separation                                | Separate Firebase projects required                  |
  | Bout results via CF only                           | recordBoutResult, correctBoutResult, markBoutDidNotHappen |
  | Result correction window enforced                  | 7 days for hosting club; admin unrestricted          |
  | Result corrections audited                         | Before/after state logged to auditLogs               |
  | Boxer W/L counters atomically updated              | On result record/correct, counters adjusted in same transaction |

  - docs/architecture/Firebase implementation plan.md — Concrete Firebase execution blueprint (derived, non-authoritative)

