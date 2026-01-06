# **FirstBell MVP — Sprint Plan v1.2**

**Role:** Scrum Master
**Inputs:** PRD v1.1 + Architecture v1.1 + Epics & Stories v1.4
**Goal:** De-risk the core value loop as early as possible

This plan supersedes Sprint Plan v1.1.

---

## **Sprint Strategy**

### **Guiding Principles**

* Build thin vertical slices
* Enforce architecture invariants early
* Admin safety is not optional
* Avoid speculative features

---

### **Phase vs Sprint Alignment**

The Code Execution Brief defines **Phases** (technical build order). This Sprint Plan defines **Sprints** (story delivery). They serve different purposes:

* **Phases** = Technical guardrails and constraints (authoritative for *how* to build)
* **Sprints** = Story delivery roadmap (authoritative for *what* to deliver)

**Alignment:**

| Code Execution Brief | Sprint Plan | Notes |
|---------------------|-------------|-------|
| Phase 0 — Environment & Safety | Sprint 0 (infrastructure) | Firebase projects, rules scaffold |
| Phase 1 — Core Data Skeleton | Sprint 0 (absorbed) | Collection validation happens via story implementation |
| Phase 2 — Club Claim Flow | Sprint 1 | Epic 2.1, 2.2, 3.2 |
| Phase 3 — Roster & Boxer | Sprint 2 | Epic 4.1, 4.2, 4.3 |
| Phase 4 — Discovery | Sprint 3 | Epic 5.1, 6.1 |
| **Phase 4.5 — AI Integration** | **Sprint 3.5** | **Epic 11.1–11.5 (AI-first UI)** |
| Phase 5 — Proposals | Sprint 4 | Epic 7.1, 7.2, 9.3 |
| Phase 6 — Shows & Slots | Sprint 5 | Epic 8.1, 8.2, 8.3 |
| Phase 6.5 — Bout Results | Sprint 5.5 | Epic 10.1–10.4 |
| Phase 7 — Admin Controls | Sprint 6 | Epic 9.1, 9.2, 10.3, 10.5 |

**Key Decision:** Phase 1 (Core Data Skeleton) is absorbed into Sprint 0. Firestore collections are created on first write, and rule validation occurs naturally when implementing Epic 1.1 and 1.2. No separate "skeleton" story is needed.

---

## **Sprint 0 — Setup & Guardrails**

**Objective:** Prevent architectural and security drift.

### **Infrastructure (Phase 0) — ✅ Complete**

* Firebase project configuration
* Firebase Auth emulator setup
* Firestore security rules scaffold
* Cloud Storage rules
* Cloud Functions scaffold with kill switch helper
* Emulator seed script for `admin/settings`

### **Stories to Implement**

* Story 1.1 — User Authentication
* Story 1.2 — Platform Admin Role

### **Phase 1 Absorption**

Phase 1 (Core Data Skeleton) from the Code Execution Brief is absorbed into this sprint. Collection structure validation occurs through story implementation:
* `users/{userId}` validated via Story 1.1
* `admin/settings` validated via Story 1.2
* Rule validation happens via Cloud Function tests

### **Exit Criteria**

* ✅ Firestore rules deployed
* ✅ Users can authenticate (creates `users/{userId}` on first login)
* ✅ Platform admin can be designated (`isPlatformAdmin` claim)

---

## **Sprint 1 — Club Claim & Identity**

**Objective:** Establish club ownership and trust.

### **Included Stories**

* Epic 2.1 — Pre-Seeded Club Directory  
* Epic 2.2 — Claim a Club  
* Epic 3.2 — View Club Members

### **Exit Criteria**

* Club can be claimed end-to-end  
* Admin approval audited

---

## **Sprint 2 — Roster Activation**

**Objective:** Get usable boxer data into the system.

### **Included Stories**

* Epic 4.1 — Upload Draft Roster (CSV)  
* Epic 4.2 — Confirm Roster  
* Epic 4.3 — Edit Boxer Profile

### **Exit Criteria**

* Active roster exists  
* No boxer active without confirmation

---

## **Sprint 3 — Discovery & Matchmaking**

**Objective:** Enable compliant opponent discovery.

### **Included Stories**

* Epic 5.1 — Browse Other Clubs' Boxers
* Epic 6.1 — Match a Boxer (AI-first interaction)

### **Exit Criteria**

* Viable opponents surfaced
* Non-compliant matches never displayed

---

## **Sprint 3.5 — AI-First Frontend & Voice**

**Objective:** Deliver the AI-first user experience that differentiates FirstBell.

### **Included Stories**

* Epic 11.1 — PWA Shell & Navigation
* Epic 11.2 — AI Bar (Text Input)
* Epic 11.3 — Voice Input Integration
* Epic 11.4 — AI Inbox (Proactive Cards)
* Epic 11.5 — AI Cloud Function Integration

### **Exit Criteria**

* Users can interact via natural language (text and voice)
* AI surfaces proactive match suggestions
* Traditional navigation available as fallback
* AI cannot mutate state without user confirmation

### **Dependencies**

* Requires Sprint 3 completion (matchmaking data available)
* AI Cloud Function mediates all LLM interactions
* Voice uses browser-native Web Speech API

---

## **Sprint 4 — Proposals & Safety Controls**

**Objective:** Secure the core value moment safely.

### **Included Stories**

* Epic 7.1 — Send Bout Proposal  
* Epic 7.2 — Respond to Proposal (Deep Link)  
* Epic 9.3 — Kill Switch for Proposals

### **Exit Criteria**

* Bout can be proposed and accepted  
* Kill switch can disable new proposals immediately

---

## **Sprint 5 — Shows & Slots**

**Objective:** Validate show-building.

### **Included Stories**

* Epic 8.1 — Create a Show
* Epic 8.2 — View National Show Feed
* Epic 8.3 — Fill Show Slots

### **Exit Criteria**

* Show card can be partially filled

---

## **Sprint 5.5 — Bout Result Recording**

**Objective:** Enable post-show result capture and boxer record automation.

### **Included Stories**

* Epic 10.1 — Record Bout Result
* Epic 10.2 — Mark Bout Did Not Happen
* Epic 10.3 — Correct Bout Result (hosting club within 7 days)
* Epic 10.4 — Manually Edit Boxer Record (confirm existing capability not locked)

### **Exit Criteria**

* Hosting club can record bout results after show
* Boxer W/L counters update automatically
* Results can be corrected within 7-day window
* Opposing club is notified of recorded results

---

## **Sprint 6 — Admin Oversight & Recovery**

**Objective:** Ensure operational resilience.

### **Included Stories**

* Epic 9.1 — Admin Dashboard
* Epic 9.2 — Manage System Settings
* Epic 10.3 — Correct Bout Result (admin authority beyond 7 days)
* Epic 10.5 — Periodic Boxer Record Review Prompt

### **Exit Criteria**

* Admin can inspect and recover from common issues
* Admin can correct bout results beyond 7-day window
* Clubs receive prompts to review boxer records

---

## **MVP Exit Criteria**

MVP is complete when the following loop works end-to-end:

* Club claimed
* Roster confirmed
* **Match found via AI-first interface (text or voice)**
* Proposal sent and accepted via deep link
* Show created with slots filled
* Bout results recorded after show
* Boxer W/L records updated automatically
* Admin can audit and intervene (including result corrections beyond 7 days)
* **AI proactively surfaces actionable suggestions**

---

## **Change Log**

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-06 | 1.2 | Added Sprint 3.5 (AI-First Frontend). Updated Phase alignment table with Phase 4.5. Updated authority refs to v1.1. Updated MVP exit criteria for AI. | Bob (SM) |
| — | 1.1 | Added Phase/Sprint alignment, Phase 1 absorption into Sprint 0 | — |
| — | 1.0 | Initial sprint plan | — |

