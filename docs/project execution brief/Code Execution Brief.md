# **Ringcraft — Claude Code Execution Brief (MVP)**

**Audience:** Claude Code / Engineers  
**Authority:** Architecture v1 \+ Invariants §12  
**Purpose:** Build Ringcraft MVP without architectural drift

This document tells you **how to build Ringcraft**, **in what order**, and **what you must not do**. If anything here conflicts with implementation instincts, this document wins.

---

## **1\. Golden Rules (Read First)**

1. **Architecture v1 is law** — especially Section 12 (Invariants).  
2. **Cloud Functions own state transitions**. Clients request, never mutate.  
3. **Nothing is authoritative** except system state (statuses, timestamps).  
4. **Derived data is never stored**.  
5. **Admins exist for recovery, not control**.

Violating any of the above is a bug, even if the feature “works”.

---

## **2\. Build Order (Do Not Reorder)**

### **Phase 0 — Environment & Safety**

* Create **two Firebase projects**: `ringcraft-dev`, `ringcraft-prod`  
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
* Slot \+ bout updates must be atomic

---

### **Phase 7 — Admin & Safety Controls**

* Admin dashboard (read-first)  
* System settings editor (`admin/settings`)  
* Proposal kill switch  
* Audit log viewer

Admin UI should be functional, not polished.

---

## **3\. Explicit DO NOT List (Non-Negotiable)**

* ❌ Do not store derived data (age, eligibility)  
* ❌ Do not let clients update proposal, bout, or slot state  
* ❌ Do not expose boxer data publicly  
* ❌ Do not skip audit logging for admin actions  
* ❌ Do not merge dev and prod environments

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

