# **Ringcraft MVP — Epics & User Stories (v1.1)**

**Status:** Authoritative backlog (supersedes v1.0)  
**Sources:** PRD \+ Architecture v1 (incl. Section 12 Invariants)  
**Audience:** Engineers, Claude Code, Product Owner

This document incorporates all architectural corrections identified in review. Any prior Epics & Stories documents are superseded by this version.

---

## **EPIC 1 — Platform Foundations & Identity**

### **Goal**

Establish secure identity, club-centric access, and platform admin separation.

### **Story 1.1 — User Authentication**

**As a** club official  
**I want** to sign up and log in securely  
**So that** I can access Ringcraft features.

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
* Only members of the same club can view the list

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

Surface viable, compliant match options.

### **Story 6.1 — Match a Boxer**

**As a** club official  
**I want** to find compliant opponents  
**So that** I avoid illegal bouts.

**Acceptance Criteria**

* Firestore queries retrieve candidates using static fields only  
* Age and experience compliance is computed at runtime  
* **No compliance or eligibility fields are persisted**  
* Non-compliant matches are excluded before display

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
**So that** I can capture pre-Ringcraft history and bouts outside the platform.

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

## **Status**

**Epics & Stories v1.2 — Updated with Epic 10 (Bout Results)**

