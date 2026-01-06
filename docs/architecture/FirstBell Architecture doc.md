# **FirstBell — System Architecture (MVP)**

**Status:** Authoritative v1  
**Scope:** MVP (non-authoritative, England Boxing–aligned)  
**Audience:** Founder, engineers, Claude Code, advisors

This document consolidates **product intent, data model, access rules, and operational constraints** into a single source of truth. If any future implementation contradicts this document, the implementation is wrong.

---

## **1\. Architecture Overview**

FirstBell is a **club-centric coordination system** for UK amateur boxing. It replaces manual matchmaking and fragmented communication with a single, auditable workflow that enables clubs to find, negotiate, and secure compliant bouts.

### **Core Characteristics**

* **Non-authoritative at MVP** (not a system of record)
* **AI-first interaction** (natural language and voice as primary user input)
* **Compliance-aware by design** (filters illegal bouts before proposal)
* **Action-oriented** (intent → secured bout in minutes)
* **Failure-tolerant** (assumes human error and recovery)
* **Admin-operable** (human intervention is expected early)

FirstBell is explicitly designed to integrate with **England Boxing’s Locker** in later phases, but no coupling exists at MVP.

---

## **2\. System Components**

### **2.1 Client**

* **Progressive Web App (PWA)**
* Mobile-first, touch-optimised
* **AI-first interface:**
  * Persistent AI bar for natural language input (text and voice)
  * AI-driven inbox with proactive actionable cards
  * Voice input via Web Speech API (browser-native)
  * Fallback traditional navigation for direct access
* Offline-read tolerant (cached rosters, shows, proposals)
* Deep-link landing pages for no-login proposal responses

### **2.2 Backend (Firebase)**

* **Firebase Auth** — user identity  
* **Firestore** — primary data store  
* **Cloud Functions** — trusted execution layer  
* **Cloud Storage** — roster CSV uploads  
* **Firebase Hosting** — app \+ deep-link routes

### **2.3 External Services**

* WhatsApp (link-based)
* SMS fallback (e.g. Twilio)

### **2.4 AI Service Layer**

The AI layer enables natural language interaction and proactive assistance.

**Components:**

* **LLM Integration** — External AI service (e.g., Claude API) for natural language understanding and response generation
* **Voice-to-Text** — Browser-native Web Speech API for voice input (no external service required)
* **AI Cloud Function** — Mediates between client and LLM, enforces context boundaries

**Architectural Boundaries:**

* AI has **read-only access** to user's club data (rosters, proposals, shows)
* AI **cannot mutate state** directly — all actions require user confirmation and execute via existing Cloud Functions
* AI responses are **advisory only** — compliance decisions remain computed, not AI-generated
* AI context is **scoped to authenticated user's club** — no cross-club data leakage

**AI Capabilities (MVP):**

* Parse natural language match requests ("Find a match for Jake, 72kg")
* Explain match suggestions and compliance reasoning
* Surface relevant actionable items proactively
* Answer questions about boxer/club data in context

**AI Non-Capabilities (MVP):**

* No autonomous actions (all require user confirmation)
* No access to other clubs' private data
* No EB rule interpretation beyond embedded compliance logic

---

## **3\. Identity & Access Model**

### **3.1 Users**

* Users are global identities  
* Stored in `users/{userId}`  
* A user may belong to one or more clubs (rare but supported)

### **3.2 Club Membership**

* Membership is club-scoped: `clubs/{clubId}/members/{userId}`  
* Flat permissions at MVP  
* Roles (`coach`, `matchmaker`, etc.) are **descriptive only**

### **3.3 Platform Admin**

* Separate trust domain  
* Identified via Firebase custom claim `isPlatformAdmin=true`  
* Never mixed with club permissions

---

## **4\. Core Domain Model (Authoritative)**

### **4.1 Clubs**

* Primary operating entity  
* Pre-seeded into Firestore  
* Lifecycle: `unclaimed → claim_pending → claimed → suspended`

**Invariant:** Clubs are never deleted.

---

### **4.2 Members**

* Stored as subcollection under club  
* Denormalised display data (name, role, photo) is intentional

---

### **4.3 Boxers**

* Stored under exactly one club: `clubs/{clubId}/boxers/{boxerId}`  
* `boxerId` is globally unique  
* Never shared across clubs

**Key Properties**

* Identity: name, DOB, category  
* Declared record: bouts/wins/losses (non-authoritative)  
* Status: `draft | active | archived`  
* Availability: `available | unavailable | injured`

**Critical Rule:**

Age is never stored. Age is always computed relative to show date.

---

### **4.4 Shows & Slots**

#### **Shows**

* Top-level collection for national feed  
* Includes full venue address (public once published)  
* Timing fields: weigh-in start/end, boxing start

#### **Slots**

* Subcollection of shows  
* Define opponent requirements  
* Lifecycle: `open → proposed → secured → closed`

---

### **4.5 Proposals & Bouts**

#### **Proposals**

* Represent negotiation state
* Readable only by sender, recipient, and admin
* Contain **immutable boxer snapshots**

#### **Bouts**

* Created on proposal acceptance
* Canonical representation of agreed bout
* Non-authoritative but auditable

**Bout Lifecycle:**
`agreed → completed | did_not_happen | cancelled`

* `agreed` — Bout accepted, awaiting show date
* `completed` — Result recorded by hosting club
* `did_not_happen` — Bout was agreed but never took place (e.g., boxer withdrawal on day, medical stoppage before bout)
* `cancelled` — Bout cancelled in advance (before show date)

**Result Fields (populated on completion):**

* `winnerId` — Boxer ID of winner
* `loserId` — Boxer ID of loser
* `recordedBy` — User ID who recorded result
* `recordedAt` — Timestamp of result recording
* `lastEditedBy` — User ID of last editor (if corrected)
* `lastEditedAt` — Timestamp of last edit (if corrected)

**Result Correction Window:**

* Hosting club may edit results within 7 days of recording
* After 7 days, corrections require platform admin intervention
* All corrections are audited

---

### **4.6 Deep-Link Tokens**

* Single-purpose, time-bound  
* Bound to proposal and target club  
* Never grant direct Firestore access  
* Always resolved via Cloud Functions

---

### **4.7 Admin & Audit**

* `admin/settings` — kill switches  
* `admin/auditLogs` — append-only

**Invariant:** Audit logs are immutable.

---

## **5\. Data Model Summary (Collections)**

* `users`  
* `clubs`  
  * `members`  
  * `boxers`  
  * `rosterImports`  
* `shows`  
  * `slots`  
* `proposals`  
* `bouts`  
* `deeplinkTokens`  
* `admin/settings`  
* `admin/auditLogs`

This structure is intentionally denormalised for Firestore performance.

---

## **6\. Access Control & Rules Model**

### **6.1 General Principles**

* Club data writable only by owning club members  
* Cross-club reads allowed for boxer discovery (authenticated only)  
* All multi-document state transitions occur in Cloud Functions

---

### **6.2 Boxer Visibility (Explicit Decision)**

* Authenticated club members may view boxers from other clubs  
* Visible fields include: name, DOB, age (derived), declared record  
* No public or anonymous access

**Safeguards**

* No public URLs  
* No indexing by search engines  
* Admin investigation capability

---

### **6.3 Proposal Privacy**

* Proposals readable only by:  
  * fromClub  
  * toClub  
  * platform admin

---

### **6.4 Deep-Link Response Security**

* Response handled via Cloud Function only  
* Validations:  
  1. Token active & not expired  
  2. Token bound to target club  
  3. Proposal still actionable  
  4. Kill switch not engaged  
* Idempotent handling of repeat clicks

---

### **6.5 Admin Authority**

Admins may:

* Approve/revoke club claims  
* Merge or suspend clubs  
* Void bouts  
* Hide shows  
* Pause proposal sending

All actions are audited.

---

## **7\. Key Workflows (Architectural View)**

### **7.1 Club Claim**

User → claim request → admin approval → club active

### **7.2 Roster Import**

CSV upload → parse → draft boxers → explicit confirmation → active

### **7.3 Matchmaking (AI-Driven)**

**User-initiated (via AI bar):**
Natural language request → AI parses intent → Firestore query → compliance filter → AI presents shortlist with reasoning

**AI-proactive (via inbox):**
AI monitors roster + open slots → identifies potential matches → surfaces actionable cards → user reviews and acts

**Technical flow (unchanged):**
1. Firestore queries retrieve broad candidate sets using static fields
2. Compliance filtering (age, experience, EB rules) computed client-side or in Cloud Functions
3. AI layer handles presentation and explanation only — does not modify compliance logic

### **7.4 Proposal Flow**

Create proposal → send deep link → accept/decline → bout \+ slot update

### **7.5 Admin Intervention**

Detect issue → correct data → audit log → notify clubs if needed

### **7.6 Bout Result Recording**

Show date passes → hosting club prompted to record results → for each bout:

**If result recorded by hosting club:**
1. Hosting club selects winner for each bout on their show card
2. Cloud Function validates and updates bout status to `completed`
3. Winner's `wins` counter incremented
4. Loser's `losses` counter incremented
5. Both boxers' `bouts` counter incremented
6. Opposing club notified: "Result recorded — no action needed"
7. Audit log written

**If result NOT recorded by hosting club:**
1. Opposing club prompted to update boxer record manually
2. Club manually adjusts W/L on their boxer's profile
3. Bout remains in `agreed` status (stale)

**Result correction (within 7 days):**
1. Hosting club edits result
2. Previous winner's `wins` decremented, `losses` incremented
3. Previous loser's `losses` decremented, `wins` incremented
4. Audit log records correction with before/after state

**Periodic review prompt:**
Clubs prompted to review and refresh boxer records periodically until result automation is fully adopted.

---

## **8\. Offline & Reliability Strategy**

* Offline-read guaranteed for:  
  * rosters  
  * shows  
  * proposals  
* Write actions require connectivity  
* Failures degrade with clear messaging, not errors

---

## **9\. Privacy, Safeguarding & Compliance**

* DOB visibility limited to authenticated club officials  
* Boxer data labelled: "Visible to registered boxing clubs only"  
* Full address public only for published shows  
* No medical or suspension authority claimed

---

## **10\. Future Evolution (Non-MVP)**

* England Boxing Locker integration  
* Official bout history sync  
* Role-based permissions  
* Club voting & conditional acceptance  
* Enhanced governance & reporting

---

## **11\. Architectural Non-Goals**

* No attempt to replicate EB governance  
* No automated eligibility certification  
* No public boxer profiles  
* No analytics dashboards at MVP

---

## **12\. Architectural Invariants & Execution Rules (Authoritative)**

This section defines **non-negotiable architectural rules** for the FirstBell MVP. These rules exist to prevent logic drift, security regressions, and accidental overreach during implementation.

If any implementation violates these rules, the implementation is incorrect.

---

### **12.1 Data Authority Classification**

All data in FirstBell falls into one of four authority classes. These classes determine **where data originates, how it is updated, and how it must be treated**.

**A) Declared Data (Club-Provided)**  
Examples:

* Boxer declared weight  
* Boxer bout totals (wins/losses/bouts)  
* Boxer availability status  
* Club comments / notes

Rules:

* Declared data is not validated as official  
* Declared data may be incorrect or incomplete  
* The system must never claim this data is authoritative  
* Declared data must be editable by the owning club  
* Declared data must be auditable

**B) Derived Data (Computed, Never Stored)**  
Examples:

* Boxer age (derived from DOB \+ show date)  
* Age deltas between opponents  
* Compliance eligibility flags

Rules:

* Derived data is never persisted  
* Derived data is computed client-side or in Cloud Functions  
* Firestore queries must not attempt to compute derived values

**C) System-Generated Data (Authoritative Within FirstBell)**
Examples:

* Proposal status
* Bout status
* Slot state
* Bout result (winner/loser, once recorded)
* Audit logs

Rules:

* System-generated data must not be directly mutable by clients
* State transitions must be atomic and validated

**Clarification — Bout Results vs Boxer W/L:**

* **Bout result** is system-generated: recorded via Cloud Function, immutable after correction window, authoritative for that specific bout within FirstBell
* **Boxer W/L counters** remain declared data: auto-incremented by FirstBell bout results, but manually editable by clubs to account for pre-FirstBell history and bouts arranged outside the platform
* This hybrid approach enables automation while preserving club control over their boxer records

**D) Non-Authoritative Indicators**  
Examples:

* Compliance filters  
* Match recommendations

Rules:

* Indicators are advisory only  
* Must not imply England Boxing approval

---

### **12.2 Read vs Write Execution Boundaries**

**Clients may:**

* Read permitted Firestore documents  
* Create draft data within their own club scope  
* Initiate actions via Cloud Functions

**Clients must never:**

* Change proposal status directly  
* Change bout records directly  
* Change slot state directly  
* Write audit logs  
* Create or update deep-link tokens

All such actions must occur in Cloud Functions.

---

### **12.3 Matchmaking Execution Rule**

Matchmaking is a two-stage process:

1. Firestore queries retrieve broad candidate sets using static fields  
2. Compliance filtering (age, experience, EB rules) occurs client-side or in Cloud Functions

Firestore rules and queries must not encode boxing rules.

---

### **12.4 Deep-Link Security Invariants**

* Tokens are single-purpose, time-bound, and club-bound  
* Tokens are validated and consumed server-side only  
* Deep links must never grant direct Firestore access or expose directories

---

### **12.5 Admin Scope & Philosophy**

Admins are platform stewards, not boxing authorities.

Admin interfaces are:

* Internal-only  
* Low-polish  
* Read-first

All admin mutations must be explicit, auditable, and reversible where possible.

---

### **12.6 Notification & Event Model (MVP)**

* Cross-club communication via WhatsApp/SMS deep links  
* In-app state reflects current truth  
* No push notifications required at MVP

---

### **12.7 Environment Separation Rule**

* Dev and prod use separate Firebase projects  
* Seed data must never enter production  
* Admin actions in non-prod must be clearly marked or restricted

---

### **12.8 Failure Is Expected**

The system assumes human error and partial data.  
Design must prioritise recovery paths, idempotent operations, and admin-assisted resolution.

Silent failure is unacceptable.

---

### **12.9 Final Authority Statement**

This section is authoritative. If any implementation decision conflicts with this section or the core architecture document, the implementation must be corrected.

---

## **Architecture Status**

**Architecture v1.1 — Updated**

This document, together with the PRD, defines the authoritative blueprint for FirstBell MVP.

---

## **Change Log**

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-06 | 1.1 | Added AI-first interaction as core characteristic. Added Section 2.4 (AI Service Layer) defining LLM integration, architectural boundaries, and AI capabilities/limitations. Updated Section 2.1 (Client) with AI bar and voice input. Updated Section 7.3 (Matchmaking) with AI-driven workflow. | Winston (Architect) |
| — | 1.0 | Initial architecture document | — |

