# **Product Requirements Document (PRD) — Ringcraft**

---

## **1\. Product Overview & Objectives**

### **Product Description**

Ringcraft is an AI-assisted matchmaking and show-building platform for UK amateur boxing clubs. It replaces fragmented manual workflows—static databases, phone calls, and unstructured messaging—with a single coordination utility that enables clubs to find, negotiate, and secure compliant amateur bouts quickly and reliably.

Ringcraft operates as a **non-authoritative coordination layer** at launch. It does not replace England Boxing’s official systems nor claim regulatory authority. Instead, it embeds England Boxing technical rules directly into the matchmaking process to prevent non-compliant bouts from being proposed.

The product is designed for real-world club conditions: time-poor volunteers, shared responsibility across committees, and inconsistent connectivity.

---

### **Problem Summary**

UK amateur boxing matchmaking currently suffers from:

1. Manual, time-consuming coordination across multiple tools  
2. High compliance risk due to unofficial or stale data  
3. Poor visibility into upcoming shows and open bout slots (“Show Blindness”)  
4. Fragmented accountability with no shared audit trail

These issues result in administrative burnout, under-filled or cancelled shows, and avoidable compliance errors.

---

### **Target Users**

**Primary Users**

* Club officials acting on behalf of a boxing club:  
  * Coaches  
  * Club matchmakers  
  * Club secretaries  
  * Club chairpersons  
* Typically male, 35+, time-poor, low tolerance for friction

**Secondary Users**

* Show-hosting clubs (organisational usage)

**Explicitly Not Targeted (MVP)**

* Individual boxers  
* Professional boxing  
* Fans, officials, or medical staff

---

### **Product Objectives (MVP)**

1. Compress time-to-bout from hours to minutes  
2. Increase show card completion rates  
3. Reduce reliance on unstructured messaging (WhatsApp/phone)  
4. Prevent non-compliant bouts by default  
5. Achieve adoption without official system integration

---

### **Non-Objectives (MVP)**

* Acting as an official system of record  
* Guaranteeing eligibility or medical clearance  
* Replacing England Boxing governance  
* Boxer self-service accounts  
* Professional boxing support

---

## **2\. User Personas & Core Use Cases**

### **Primary Personas**

**Club Matchmaking Official**

* Acts on behalf of the club  
* Responsible for matchmaking and show coordination  
* Works evenings/weekends, often on mobile

**Show-Hosting Club Official**

* Same user operating under deadline pressure  
* Responsible for filling show cards

---

### **Core Use Cases (MVP)**

* Claim a pre-seeded club  
* Confirm or upload club roster (CSV)  
* Find compliant matches for boxers or show slots  
* Propose bouts via structured messages  
* Accept or decline bouts via deep links (no login)  
* Create and manage shows and open slots

---

### **Explicitly Out of Scope (MVP)**

* England Boxing Locker integration  
* Boxer self-confirmation  
* Conditional acceptance states  
* Club voting or deliberation  
* Automatic suspension or medical updates

---

## **3\. Functional Requirements (MVP)**

### **3.1 Club & Access Model**

* Club-centric identity model  
* Flat permissions for all club users  
* Invite additional users to a club  
* Claim pre-seeded clubs with verification

---

### **3.2 Club Directory**

* Searchable national club directory  
* Club profile pages  
* Contact routing via controlled messaging links

---

### **3.3 Roster & Boxer Management**

* Club roster with minimum matchmaking attributes  
* Draft CSV import  
* Explicit confirmation before activation  
* Editable post-confirmation  
* Full audit trail

---

### **3.4 Matchmaking & Compliance Filtering**

* Search for matches via structured input (NL optional later)  
* Filter non-compliant matches (age, weight, experience)  
* Display shortlist of viable opponents

---

### **3.5 Bout Proposal Workflow**

* Create bout proposals  
* Send via WhatsApp/SMS deep links  
* Accept/Decline without login  
* Track proposal states (proposed, accepted, declined, expired)  
* Notify both clubs on state change

---

### **3.6 Show Feed & Show Management**

* Create and manage shows
* Define open slots
* National show feed
* "Check my roster" against open slots
* Update show cards on bout acceptance

**Bout Results Capture (Show Close-Out)**

* Hosting club records bout results as part of show close-out
* Binary outcome per bout: Win or Loss (no draws in amateur boxing)
* Bouts that don't take place (e.g., boxer withdrawal on day) marked as "did not happen" — no W/L impact
* On result submission:
  * Bout record updated with outcome
  * Both boxers' win/loss records updated automatically
  * Opposing club notified of recorded result (no action required)
* Show organiser is authoritative for results at their event
* Low-friction flow integrated into existing bout card view

**Result Correction & Fallback**

* Hosting club may correct results within 7 days of recording
* After 7 days, corrections require platform admin
* If hosting club does not record results, opposing club is prompted to update their boxer's record manually

**Boxer Record Management**

* Boxer W/L counters remain editable by owning club
* Enables manual updates for bouts arranged outside Ringcraft
* Clubs prompted to periodically review and refresh boxer records until result automation is fully adopted

---

### **3.7 Platform Administration (MVP)**

**Admin Role**

* Platform admin distinct from club users

**Admin Capabilities**

* View, approve, revoke, merge, or deactivate clubs  
* View and manage users  
* Inspect rosters, bouts, proposals, and shows (read-first)  
* Moderate shows and bouts  
* Pause outbound proposals (kill switch)  
* Full audit logging of admin actions

---

## **4\. User Journeys & Key Screens (Summary)**

* Club claim & activation  
* Draft roster review & confirmation  
* Find match → send proposal  
* Receive proposal → accept/decline via deep link  
* Create show → fill open slots  
* Admin oversight & intervention

Non-happy paths (conflicts, errors, disputes) are resolved via admin-assisted recovery.

---

## **5\. Non-Functional & UX Constraints (MVP)**

### **UX Constraints**

* Speed over depth: single-screen actions where possible  
* Zero-training requirement  
* WhatsApp-first mental model  
* No implication of official authority  
* Forgiveness and reassurance in flows

### **Technical Constraints**

* Mobile-first  
* Low-connectivity tolerant (offline read, graceful write failure)  
* Stateless, single-purpose, time-bound deep links  
* Full operational traceability

### **Security & Privacy**

* No public exposure of personal phone numbers  
* Strict separation of admin vs club access  
* Clear distinction between club-declared and future official data  
* Clubs may request data removal (subject to audit retention)

### **Failure-Tolerant Design Principle**

The system assumes mistakes, partial data, and human error are normal and prioritises recovery over enforcement.

---

## **6\. UX & Design Direction (MVP)**

### **Design Philosophy**

* Utility, not platform  
* Dip-in tool, not system  
* Feels like structured WhatsApp, not software

### **Visual & Interaction Constraints**

* Clean, minimal, high-contrast  
* Card-based layouts  
* One primary action per screen  
* Tap-first, thumb-friendly

### **Language & Tone**

* Plain English  
* Familiar boxing terminology  
* No AI or SaaS jargon

### **Brand Positioning (MVP)**

* Practical  
* Trustworthy  
* Calm under pressure  
* Neutral and non-authoritative

---

