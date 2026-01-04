# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ringcraft is an AI-assisted matchmaking platform for UK amateur boxing clubs. It replaces manual coordination workflows (databases, phone calls, WhatsApp) with a club-centric system for finding, negotiating, and securing compliant amateur bouts.

**Key characteristic:** Non-authoritative at MVP — Ringcraft does not replace England Boxing's official systems. It embeds EB technical rules into matchmaking to prevent non-compliant bouts from being proposed.

## Tech Stack

- **Frontend:** Progressive Web App (PWA), mobile-first, offline-read tolerant
- **Backend:** Firebase (Auth, Firestore, Cloud Functions, Cloud Storage, Hosting)
- **External:** WhatsApp (link-based), SMS/Twilio fallback
- **Environment:** Nix-based (`.idx/dev.nix`), Google IDX workspace

## Build Commands

*Project is pre-implementation. When code is added, update this section with:*
- Build/dev server commands
- Test runner commands
- Lint/format commands

Environment is managed via `.idx/dev.nix`. Uncomment and configure packages as needed.

## Architecture Rules (Non-Negotiable)

These rules from Architecture v1 Section 12 must never be violated:

1. **Cloud Functions own state transitions** — Clients request actions via Cloud Functions; clients never directly mutate proposal, bout, slot, or token state
2. **Derived data is never stored** — Age is computed from DOB + show date; compliance flags are computed at runtime; never store `isEligible` or similar
3. **Boxer data is never public** — Visible only to authenticated club members
4. **Deep links are single-purpose** — Time-bound, club-bound, resolved only via Cloud Functions, never grant direct Firestore access
5. **All admin actions are audited** — Audit logs are append-only and immutable

## Data Model

```
users                          # Global identities
clubs                          # Primary entities (pre-seeded)
  └── members                  # Club membership
  └── boxers                   # Athletes (never shared across clubs)
        ├── declaredWins       # Auto-incremented on bout result, manually editable
        ├── declaredLosses     # Auto-incremented on bout result, manually editable
        └── declaredBouts      # Auto-incremented on bout result, manually editable
  └── rosterImports            # CSV upload tracking
shows                          # Hosting events
  └── slots                    # Open bout positions
proposals                      # Negotiation state
bouts                          # Agreed matches (status: agreed → completed | did_not_happen | cancelled)
  └── result                   # winnerId, loserId, recordedBy, recordedAt, lastEditedBy, lastEditedAt
deeplinkTokens                 # Single-use response links
admin/settings                 # Kill switches
admin/auditLogs                # Immutable audit trail
```

## Data Authority Classes

- **Declared data** (club-provided): Editable, not validated, not authoritative (boxer weights, bout totals)
- **Derived data** (computed): Never persisted (age, eligibility)
- **System-generated** (authoritative within Ringcraft): Not client-writable (proposal/bout status, bout results)
- **Non-authoritative indicators**: Advisory only (compliance filters, match recommendations)

**Bout Results vs Boxer W/L (Hybrid Model):**
- **Bout result** is system-generated: recorded via Cloud Function, authoritative for that bout
- **Boxer W/L counters** remain declared data: auto-incremented on result, but manually editable by clubs for pre-Ringcraft history and bouts arranged outside the platform
- **Periodic review prompts**: Clubs are prompted to review and refresh boxer records until result automation is fully adopted

## Build Order

Implementation must follow this sequence:
1. Phase 0: Environment & Safety (Firebase projects, Auth, security rules first)
2. Phase 1: Core Data Skeleton (collections, rules validation)
3. Phase 2: Club Claim Flow (Cloud Function, lifecycle states, auditing)
4. Phase 3: Roster & Boxer Management (CSV upload, draft→active workflow)
5. Phase 4: Discovery & Matchmaking (queries retrieve candidates, filtering at runtime)
6. Phase 5: Proposals & Deep Links (immutable snapshots, token security)
7. Phase 6: Shows & Slots (atomic slot+bout updates)
8. Phase 6.5: Bout Result Recording (result capture, W/L counter updates, corrections)
9. Phase 7: Admin & Safety Controls (read-first dashboard, kill switches, result correction beyond 7 days)

## Key Firestore Security Rules Principles

- Club data writable only by owning club members
- Cross-club boxer reads allowed for authenticated users (discovery)
- Proposal readable only by fromClub, toClub, and platform admin
- Admin identified via custom claim `isPlatformAdmin=true`
- All multi-document transitions occur in Cloud Functions

## DO NOT List

- Do not store derived data (age, eligibility flags)
- Do not let clients update proposal, bout, or slot state directly
- Do not expose boxer data publicly or to search engines
- Do not skip audit logging for admin actions
- Do not merge dev and prod Firebase environments
- Do not design for future EB integration in MVP logic

## Key Documentation

- `docs/prd/Ringcraft PRD.md` — Product requirements
- `docs/architecture/Ringcraft Architecture doc.md` — System architecture (authoritative v1)
- `docs/project execution brief/Code Execution Brief.md` — Build order and golden rules

## BMad Method

This project uses BMad agent-based workflows. Available agents are in `.bmad-core/agents/` and can be invoked via Claude Code skills (e.g., `/architect`, `/dev`, `/qa`).

- docs/architecture/Firebase implementation plan.md — Concrete Firebase execution blueprint (derived, non-authoritative)
