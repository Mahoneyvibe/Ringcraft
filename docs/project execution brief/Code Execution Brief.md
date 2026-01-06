# **FirstBell — Claude Code Execution Brief (MVP)**

**Audience:** Claude Code / Engineers
**Authority:** Architecture v1.1 + Invariants §12
**Purpose:** Build FirstBell MVP without architectural drift

This document tells you **how to build FirstBell**, **in what order**, and **what you must not do**. If anything here conflicts with implementation instincts, this document wins.

---

## **1\. Golden Rules (Read First)**

1. **Architecture v1.1 is law** — especially Section 12 (Invariants).
2. **Cloud Functions own state transitions**. Clients request, never mutate.
3. **Nothing is authoritative** except system state (statuses, timestamps).
4. **Derived data is never stored**.
5. **Admins exist for recovery, not control**.
6. **AI is read-only and advisory**. AI cannot mutate state — all actions require user confirmation and execute via Cloud Functions.

Violating any of the above is a bug, even if the feature "works".

---

## **2\. Build Order (Do Not Reorder)**

### **Phase 0 — Environment & Safety**

* Create **two Firebase projects**: `firstbell-dev`, `firstbell-prod`  
* Configure Firebase Auth  
* Set up custom claims for `isPlatformAdmin`  
* Scaffold Firestore **security rules first** (even if restrictive)

If rules are added later, the architecture will be violated.

---

### **Phase 1 — Core Data Skeleton**

Create empty collections and minimal documents for:

* `users`  
* `clubs`  
* `clubs/{clubId}/members`  
* `admin/settings`  
* `admin/auditLogs`

Do **not** build UI yet. Validate reads/writes via rules.

---

### **Phase 2 — Club Claim Flow**

* Implement claim request via Cloud Function  
* Enforce club lifecycle states  
* Admin approval via Cloud Function  
* Audit every transition

**Never allow clients to set `claimed` directly.**

---

### **Phase 3 — Roster & Boxer Management**

* CSV upload → Cloud Storage  
* Parse via Cloud Function  
* Create boxers as `dataStatus=draft`  
* Explicit confirmation required to activate

Rules to enforce:

* Boxers belong to exactly one club  
* Boxer `boxerId` is globally unique  
* DOB stored, age always derived

---

### **Phase 4 — Discovery & Matchmaking**

* Firestore queries only retrieve **candidates**
* Age / experience compliance computed at runtime
* No compliance flags stored

If you find yourself wanting to store `isEligible`, stop.

---

### **Phase 4.5 — AI Integration**

* **AI Cloud Function** — mediates between client and LLM API (e.g., Claude)
* **Voice input** — browser-native Web Speech API (no backend required)
* **AI bar component** — persistent input across all screens
* **AI inbox** — proactive card feed driven by AI suggestions

**AI architectural boundaries (critical):**

* AI has **read-only access** to authenticated user's club data
* AI **cannot call state-mutating Cloud Functions** directly
* All AI-suggested actions require **explicit user confirmation** before execution
* AI context is **scoped to user's club** — never leak cross-club data to AI
* AI responses are **advisory only** — compliance logic remains computed, not AI-generated

**Implementation order:**

1. AI Cloud Function with basic prompt handling
2. AI bar UI component (text input first)
3. Voice input integration (Web Speech API)
4. AI inbox card generation
5. Contextual AI (screen-aware queries)

**Never allow AI to:**

* Execute proposals, claims, or any state changes without user confirmation
* Access boxer data from clubs the user doesn't belong to
* Generate compliance decisions (use existing computed logic)

---

### **Phase 5 — Proposals & Deep Links (Critical)**

* Proposal creation via Cloud Function  
* Store immutable boxer snapshots  
* Generate deep-link token (single-use, time-bound, club-bound)  
* Accept/decline via Cloud Function only

**Never allow client writes to proposal status.**

---

### **Phase 6 — Shows & Slots**

* Shows created by host club
* Slots transition only via accepted proposals
* Slot + bout updates must be atomic

---

### **Phase 6.5 — Bout Result Recording**

* Hosting club records bout results after show date
* Result = binary Win/Loss (no draws in amateur boxing)
* `did_not_happen` status for bouts that don't take place
* Cloud Functions: `recordBoutResult`, `correctBoutResult`, `markBoutDidNotHappen`
* On result submission:
  * Bout status → `completed`
  * Winner's `declaredWins` += 1, `declaredBouts` += 1
  * Loser's `declaredLosses` += 1, `declaredBouts` += 1
  * Opposing club notified
  * Audit log written

**Correction rules:**
* Hosting club may correct within 7 days of recording
* After 7 days, only platform admin can correct
* Corrections reverse previous counter increments before applying new result

**Important:** Boxer W/L counters remain declared data (manually editable by clubs for pre-FirstBell history). The system auto-increments but does not lock.

**Periodic review prompts:** Clubs are prompted to review and refresh boxer records until result automation is fully adopted. This is a transitional safety mechanism.

---

### **Phase 7 — Admin & Safety Controls**

* Admin dashboard (read-first)
* System settings editor (`admin/settings`)
* Proposal kill switch
* Audit log viewer
* Result correction authority (beyond 7-day window)

Admin UI should be functional, not polished.

---

## **3\. Explicit DO NOT List (Non-Negotiable)**

* ❌ Do not store derived data (age, eligibility)
* ❌ Do not let clients update proposal, bout, or slot state
* ❌ Do not let clients directly write bout result fields
* ❌ Do not expose boxer data publicly
* ❌ Do not skip audit logging for admin actions or result corrections
* ❌ Do not merge dev and prod environments
* ❌ Do not lock boxer W/L counters (they remain manually editable)
* ❌ Do not let AI execute state changes without user confirmation
* ❌ Do not pass cross-club boxer data to AI context
* ❌ Do not let AI generate compliance decisions (always compute)

---

## **4\. Security & Safeguarding Reminders**

* Boxer DOB visible only to authenticated club members  
* Deep links never expose raw Firestore access  
* Token reuse must be prevented idempotently  
* All failures must surface clear user feedback

---

## **5\. When You Are Unsure**

If an implementation choice is unclear:

1. Check Architecture v1  
2. Check Invariants §12  
3. Prefer **less automation, more auditability**

---

## **Final Instruction**

Build the **smallest thing that satisfies the story**.
Do not anticipate future EB integration in MVP logic.

If a feature requires breaking an invariant, the feature is wrong.

---

## **Change Log**

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-06 | 1.1 | Added Golden Rule #6 (AI read-only). Added Phase 4.5 (AI Integration) with boundaries and implementation order. Added AI-specific DO NOT items. Updated authority reference to Architecture v1.1. | Winston (Architect) |
| — | 1.0 | Initial execution brief | — |

---

