# **Ringcraft MVP — Sprint Plan v1.1**

**Role:** Scrum Master  
**Inputs:** PRD \+ Architecture v1 \+ Epics & Stories v1.1  
**Goal:** De-risk the core value loop as early as possible

This plan supersedes Sprint Plan v0.1.

---

## **Sprint Strategy**

### **Guiding Principles**

* Build thin vertical slices  
* Enforce architecture invariants early  
* Admin safety is not optional  
* Avoid speculative features

---

## **Sprint 0 — Setup & Guardrails**

**Objective:** Prevent architectural and security drift.

### **Included Stories**

* Epic 1.1 — User Authentication  
* Epic 1.2 — Platform Admin Role

### **Additional Mandatory Work**

* Firestore security rules scaffold enforcing read/write boundaries

### **Exit Criteria**

* Users can authenticate  
* Platform admin identified  
* Firestore rules deployed (even if restrictive)

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

* Epic 5.1 — Browse Other Clubs’ Boxers  
* Epic 6.1 — Match a Boxer

### **Exit Criteria**

* Viable opponents surfaced  
* Non-compliant matches never displayed

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

## **Sprint 6 — Admin Oversight & Recovery**

**Objective:** Ensure operational resilience.

### **Included Stories**

* Epic 9.1 — Admin Dashboard  
* Epic 9.2 — Manage System Settings  
* Epic 10.x — Audit Logging & Failure Handling

### **Exit Criteria**

* Admin can inspect and recover from common issues

---

## **MVP Exit Criteria**

MVP is complete when the following loop works end-to-end:

* Club claimed  
* Roster confirmed  
* Match found  
* Proposal sent and accepted via deep link  
* Admin can audit and intervene

---

**Sprint Plan v1.1 — Authoritative**

