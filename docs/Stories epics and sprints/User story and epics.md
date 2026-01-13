# **FirstBell MVP — Epics & User Stories (v1.4)**

**Status:** Authoritative backlog
**Sources:** PRD v1.1 + Architecture v1.1 (incl. Section 12 Invariants)
**Audience:** Engineers, Claude Code, Product Owner

This document incorporates AI-first interaction model per PRD v1.1 and Architecture v1.1 Section 2.4. Any prior Epics & Stories documents are superseded by this version.

---

## **Sprint & Phase Alignment Note**

This document defines **Epics and Stories** (what to deliver). The Code Execution Brief defines **Phases** (technical build order). See the Sprint Plan for the alignment table.

**Key Decision:** Phase 1 (Core Data Skeleton) from the Code Execution Brief is absorbed into Sprint 0. Stories 1.1 and 1.2 validate the collection structure through implementation — no separate "skeleton" work is needed.

---

## **EPIC 1 — Platform Foundations & Identity**

### **Goal**

Establish secure identity, club-centric access, and platform admin separation.

### **Story 1.1 — User Authentication**

**As a** club official  
**I want** to sign up and log in securely  
**So that** I can access FirstBell features.

**Acceptance Criteria**

* Firebase Auth is used for authentication  
* User profile is created in `users/{userId}` on first login  
* User has no club access until claim or invite

---

### **Story 1.2 — Platform Admin Role**

**As a** platform owner  
**I want** a distinct admin role  
**So that** I can manage clubs and resolve issues.

**Acceptance Criteria**

* Platform admin identified via custom claim `isPlatformAdmin=true`  
* Platform admin permissions are separate from club membership

---

## **EPIC 2 — Club Directory & Claiming**

### **Goal**

Remove cold start by pre-seeding clubs and enabling verified claiming.

### **Story 2.1 — Pre-Seeded Club Directory**

**As a** club official  
**I want** to search for my club  
**So that** I can claim it.

**Acceptance Criteria**

* Clubs exist with `status=unclaimed`  
* Club name and location are searchable

---

### **Story 2.2 — Claim a Club**

**As a** club official  
**I want** to claim my club  
**So that** I can manage its data.

**Acceptance Criteria**

* Claim request sets club to `claim_pending`  
* Admin can approve or reject claim  
* On approval, club becomes `claimed`  
* All transitions are audited

---

## **EPIC 3 — Club Membership Management**

### **Goal**

Allow multiple officials to operate under one club identity.

### **Story 3.1 — Invite Club Members**

**As a** club member  
**I want** to invite other officials  
**So that** responsibilities can be shared.

**Acceptance Criteria**

* Member can invite another user  
* Invited member has `status=invited`  
* On acceptance, member becomes `active`

---

### **Story 3.2 — View Club Members**

**As a** club member
**I want** to see who represents my club
**So that** I know who is acting on our behalf.

**Acceptance Criteria**

* Member list shows name, role, and profile photo
* Any authenticated user can view club members (read-only for directory browsing)

---

## **EPIC 4 — Boxer Roster Management**

### **Goal**

Create accurate, auditable club-declared rosters.

### **Story 4.1 — Upload Draft Roster (CSV)**

**As a** club official  
**I want** to upload a roster CSV  
**So that** boxers are created in bulk.

**Acceptance Criteria**

* CSV uploaded to Cloud Storage  
* Boxer records created with `dataStatus=draft`  
* No boxer becomes active automatically

---

### **Story 4.2 — Confirm Roster**

**As a** club official  
**I want** to review and confirm my roster  
**So that** it becomes active.

**Acceptance Criteria**

* Explicit confirmation required  
* Confirmed boxers switch to `dataStatus=active`  
* Confirmation is audited

---

### **Story 4.3 — Edit Boxer Profile**

**As a** club official  
**I want** to edit boxer details  
**So that** matchmaking remains accurate.

**Acceptance Criteria**

* Only owning club members may edit  
* Updates record editor and timestamp

---

## **EPIC 5 — Cross-Club Boxer Discovery**

### **Goal**

Enable nationwide opponent discovery.

### **Story 5.1 — Browse Other Clubs’ Boxers**

**As a** club official  
**I want** to view boxers from other clubs  
**So that** I can find opponents.

**Acceptance Criteria**

* Only authenticated club members can access boxer profiles  
* Boxer name, DOB, age (derived), and declared record are visible  
* Boxer profiles are never publicly accessible

---

## **EPIC 6 — Matchmaking & Compliance Filtering**

### **Goal**

Surface viable, compliant match options via AI-first interaction.

### **Story 6.1 — Match a Boxer (AI-First)**

**As a** club official
**I want** to find compliant opponents using natural language
**So that** I can quickly identify matches without complex forms.

**Acceptance Criteria**

* **AI-first interaction:** Users can request matches via natural language (e.g., "Find a match for Jake, 72kg")
* **AI explains reasoning:** Match suggestions include AI-generated explanation on request
* Firestore queries retrieve candidates using static fields only
* Age and experience compliance is computed at runtime
* **No compliance or eligibility fields are persisted**
* Non-compliant matches are excluded before display
* **Fallback navigation:** Traditional search/filter UI available for users who prefer it

---

## **EPIC 7 — Bout Proposals & Negotiation**

### **Goal**

Replace unstructured messaging with auditable proposals.

### **Story 7.1 — Send Bout Proposal**

**As a** club official  
**I want** to send a bout proposal  
**So that** it can be accepted or declined.

**Acceptance Criteria**

* Proposal contains immutable boxer snapshots  
* Proposal status set to `sent`  
* Proposal status transitions occur **only via Cloud Functions**

---

### **Story 7.2 — Respond to Proposal (Deep Link)**

**As a** receiving club official  
**I want** to accept or decline via a link  
**So that** responses are fast.

**Acceptance Criteria**

* Accept/decline handled via Cloud Function  
* Token is single-use and time-bound  
* **Token validated against proposal.toClubId**

---

## **EPIC 8 — Show Management & Show Feed**

### **Goal**

Create national visibility for shows and open slots.

### **Story 8.1 — Create a Show**

**As a** hosting club  
**I want** to create a show  
**So that** I can advertise open slots.

**Acceptance Criteria**

* Show includes full address and timings  
* Show may be saved as draft or published

---

### **Story 8.2 — View National Show Feed**

**As a** club official  
**I want** to see upcoming shows  
**So that** I can place boxers.

**Acceptance Criteria**

* Published shows visible nationally  
* Feed sorted by date

---

### **Story 8.3 — Fill Show Slots**

**As a** hosting club  
**I want** to secure bouts into slots  
**So that** my card is filled.

**Acceptance Criteria**

* Accepted proposals update slot state atomically  
* Slot transitions are audited

---

## **EPIC 9 — Platform Administration**

### **Goal**

Ensure operational safety and recovery.

### **Story 9.1 — Admin Dashboard**

**As a** platform admin  
**I want** system visibility  
**So that** I can resolve issues.

**Acceptance Criteria**

* Admin can view clubs, users, proposals, bouts, and shows  
* All actions are audited

---

### **Story 9.2 — Manage System Settings**

**As a** platform admin  
**I want** to manage platform settings  
**So that** I can control system behaviour.

**Acceptance Criteria**

* Admin can read and update `admin/settings`  
* Settings changes are audited and take effect immediately

---

### **Story 9.3 — Kill Switch for Proposals**

**As a** platform admin  
**I want** to pause proposal sending  
**So that** I can mitigate incidents.

**Acceptance Criteria**

* New proposals are blocked when disabled  
* Existing proposals remain readable

---

## **EPIC 10 — Bout Results & Record Management**

### **Goal**

Automate boxer record updates through show result capture, reducing manual data entry.

### **Story 10.1 — Record Bout Result**

**As a** hosting club official
**I want** to record bout results after my show
**So that** boxer records are updated automatically.

**Acceptance Criteria**

* Show organiser can record Win/Loss for each bout on their show card
* Only bouts with status `agreed` can have results recorded
* Results can only be recorded after showDate has passed
* On result submission:
  * Bout status transitions to `completed`
  * Winner's `declaredWins` and `declaredBouts` are incremented
  * Loser's `declaredLosses` and `declaredBouts` are incremented
  * Opposing club is notified
* All result recordings are audited
* **Result recording occurs only via Cloud Function** (`recordBoutResult`)

---

### **Story 10.2 — Mark Bout Did Not Happen**

**As a** hosting club official
**I want** to mark a bout that didn't take place
**So that** it doesn't affect boxer W/L records.

**Acceptance Criteria**

* Show organiser can mark bout as `did_not_happen`
* No changes to boxer W/L counters
* Bout is closed out cleanly
* Reason may be optionally captured
* **Status transition occurs only via Cloud Function** (`markBoutDidNotHappen`)

---

### **Story 10.3 — Correct Bout Result**

**As a** hosting club official
**I want** to correct a result I entered incorrectly
**So that** boxer records remain accurate.

**Acceptance Criteria**

* Hosting club may correct within 7 days of recording
* Correction reverses previous counter increments before applying new result
* After 7 days, only platform admin can correct
* All corrections are audited with before/after state
* **Correction occurs only via Cloud Function** (`correctBoutResult`)

---

### **Story 10.4 — Manually Edit Boxer Record**

**As a** club official
**I want** to manually edit my boxer's W/L record
**So that** I can capture pre-FirstBell history and bouts outside the platform.

**Acceptance Criteria**

* Owning club can edit `declaredWins`, `declaredLosses`, `declaredBouts` directly
* Edits are audited with before/after values
* System-incremented values can be manually adjusted
* This is existing functionality — no new implementation required, but must not be locked by result automation

---

### **Story 10.5 — Periodic Boxer Record Review Prompt**

**As a** club official
**I want** to be reminded to review my boxers' records
**So that** records stay accurate while result automation is being adopted.

**Acceptance Criteria**

* Clubs receive periodic prompts (mechanism TBD: in-app, notification)
* Prompt encourages review and refresh of boxer W/L data
* This is a transitional feature until result capture is fully adopted

---

## **EPIC 11 — AI-First Frontend & Voice Interface**

### **Goal**

Deliver the AI-first user experience that differentiates FirstBell, enabling natural language and voice interaction.

### **Story 11.1 — PWA Shell & Navigation**

**As a** club official
**I want** a mobile-first progressive web app
**So that** I can access FirstBell on any device.

**Acceptance Criteria**

* PWA installable on mobile devices
* Bottom navigation: Inbox, Club, Browse
* Offline-read tolerant (cached rosters, shows, proposals)
* Responsive design (mobile-first, desktop-supported)

---

### **Story 11.2 — AI Bar (Text Input)**

**As a** club official
**I want** a persistent AI input bar
**So that** I can ask questions and request actions in natural language.

**Acceptance Criteria**

* AI bar visible at top of all screens
* Accepts natural language text input
* Processes queries via AI Cloud Function
* Returns contextual responses based on current screen
* **AI cannot mutate state** — all actions require user confirmation

---

### **Story 11.3 — Voice Input Integration**

**As a** club official
**I want** to use voice input
**So that** I can interact hands-free in busy gym environments.

**Acceptance Criteria**

* Tap-to-speak button on AI bar
* Uses browser-native Web Speech API
* Visual feedback during listening (pulsing indicator)
* Transcribed text appears in input for review before sending
* Works on supported browsers (mobile and desktop)

---

### **Story 11.4 — AI Inbox (Proactive Cards)**

**As a** club official
**I want** an AI-driven inbox
**So that** I see actionable suggestions without searching.

**Acceptance Criteria**

* Home screen displays AI-generated action cards
* Card types: Match suggestions, Incoming proposals, Open slots, Result prompts
* Cards are dismissible (swipe or tap)
* AI prioritizes cards by relevance/urgency
* Cards link to relevant actions (one tap to act)

---

### **Story 11.5 — AI Cloud Function Integration**

**As a** system component
**I want** a secure AI mediation layer
**So that** AI interactions are controlled and auditable.

**Acceptance Criteria**

* AI Cloud Function mediates all client ↔ LLM communication
* **AI context scoped to authenticated user's club** — no cross-club data leakage
* **AI has read-only access** to user's club data
* **AI responses are advisory only** — compliance logic remains computed
* Rate limiting to prevent abuse
* Errors surface clear user feedback

---

## **Status**

**Epics & Stories v1.6 — Story 11.3 ACs updated for better UX and desktop support.**

## **Change Log**

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-13 | 1.6 | Story 11.3: AC4 updated for review-before-send UX, AC5 expanded to include desktop browsers | Sarah (PO) |
| 2026-01-06 | 1.5 | Story 3.2 AC 2 corrected: any authenticated user can view members (aligned with security model) | Quinn (QA) |
| 2026-01-06 | 1.4 | Added Epic 11 (AI-First Frontend & Voice). Updated Story 6.1 for AI-first interaction. Updated authority refs to v1.1. | Bob (SM) |
| — | 1.3 | Added Sprint/Phase alignment note | — |
| — | 1.0 | Initial epics and stories | — |

