# AI Frontend Prompts for FirstBell

Generated from the UI/UX Specification for use with AI frontend tools (v0, Lovable, Bolt.new).

---

## How to Use These Prompts

1. **Use them in order** — Start with the App Shell, then build each section
2. **One prompt at a time** — Don't combine them; iterate
3. **Review and refine** — AI output needs human review before production
4. **Tool recommendation:** Vercel v0, Lovable.ai, or Bolt.new

---

## Prompt 1: App Shell & Navigation

```
## Project Context

FirstBell is a PWA for UK amateur boxing clubs to find and negotiate bout matches. It's a utility tool that should feel like "structured WhatsApp" — clean, minimal, fast.

**Tech Stack:**
- Next.js 14+ with App Router
- TypeScript
- Tailwind CSS
- Shadcn/ui components
- Lucide icons

**Design System:**
- Primary color: #1E3A5F (dark blue)
- Accent: #3B82F6 (blue)
- Success: #22C55E, Warning: #F59E0B, Error: #EF4444
- Font: Inter (system-ui fallback)
- Base spacing: 4px unit

---

## High-Level Goal

Create the main app shell with:
1. Persistent AI bar at the top
2. Bottom tab navigation (mobile)
3. Side navigation (desktop)
4. Responsive layout that adapts at 768px breakpoint

---

## Detailed Instructions

1. Create a root layout component (`AppShell.tsx`) that wraps all authenticated pages

2. **AI Bar Component** (`AIBar.tsx`):
   - Fixed at top of viewport
   - Contains: text input field, microphone button (icon: `mic`), help button (icon: `help-circle`)
   - Placeholder text: "Ask anything..."
   - On mobile: compact height (48px)
   - On desktop: slightly taller with more padding
   - Clicking the bar or input should expand to full chat (implement as a modal/drawer for now, content TBD)

3. **Bottom Navigation** (`BottomNav.tsx`) - Mobile only (<768px):
   - Fixed at bottom of viewport
   - 3 tabs: Inbox (icon: `inbox`), Club (icon: `home`), Browse (icon: `search`)
   - Active tab: primary color background, bold label
   - Inactive: gray icon and label
   - Support badge/notification dot on Inbox tab

4. **Side Navigation** (`SideNav.tsx`) - Desktop only (>=768px):
   - Fixed left sidebar, 240px wide
   - Same 3 items as bottom nav, but with labels always visible
   - Logo/app name at top
   - User avatar/menu at bottom

5. **Main Content Area**:
   - Scrollable
   - Max-width 640px on desktop (centered)
   - Proper padding to avoid AI bar and nav overlap

---

## Constraints

- Use Shadcn/ui Button, Input components where appropriate
- Use Lucide icons only
- Mobile-first: design mobile layout, then adapt for desktop
- All interactive elements must be minimum 44x44px
- Support `prefers-reduced-motion`
- Do NOT create page content yet — just the shell

---

## File Structure

Create these files:
- `components/layout/AppShell.tsx`
- `components/layout/AIBar.tsx`
- `components/layout/BottomNav.tsx`
- `components/layout/SideNav.tsx`
```

---

## Prompt 2: AI Inbox Page

```
## Project Context

Continuing FirstBell PWA. The App Shell is complete. Now build the AI Inbox — the home screen showing AI-driven actionable cards.

**Existing:** AppShell, AIBar, BottomNav, SideNav components exist.

---

## High-Level Goal

Create the Inbox page with:
1. Personalized greeting header
2. Scrollable feed of action cards
3. Multiple card types (match suggestions, proposals, show alerts)

---

## Detailed Instructions

1. **Inbox Page** (`app/inbox/page.tsx`):
   - Greeting: "Good [morning/afternoon/evening], [User Name]"
   - Subtext: "[N] items need your attention" or "You're all caught up"
   - Scrollable card feed below

2. **Base Action Card Component** (`components/cards/ActionCard.tsx`):
   - White background, subtle shadow, rounded corners (8px)
   - Padding: 16px
   - Can be tapped to expand (toggle state)
   - Swipeable left to dismiss (use framer-motion or similar)

3. **Match Suggestion Card** (`components/cards/MatchSuggestionCard.tsx`):
   - Icon: boxing glove or `users`
   - Title: "Match suggestions"
   - Subtitle: "3 opponents found for [Boxer Name]"
   - Primary action button: "View Matches"
   - Expanded state shows list of 3 opponents with name, weight, record

4. **Proposal Card** (`components/cards/ProposalCard.tsx`):
   - Icon: `message-square`
   - Title: "Incoming proposal" or "Outgoing proposal"
   - Subtitle: "[Club Name] wants to match [Boxer] vs [Opponent]"
   - Actions row: Accept (green), Decline (red), Call (icon: `phone`), Details
   - Show proposal expiry time

5. **Show Slot Card** (`components/cards/ShowSlotCard.tsx`):
   - Icon: `calendar`
   - Title: "Show slot match"
   - Subtitle: "[Show Name] has a slot fitting [Boxer Name]"
   - Action button: "View Slot"

---

## Mock Data

Create a `lib/mockData.ts` with sample cards:
- 1 match suggestion card
- 2 proposal cards (1 incoming, 1 outgoing)
- 1 show slot card

---

## Constraints

- Cards must be touch-friendly (large tap targets)
- Use semantic colors: green for accept, red for decline
- Support empty state: "No new items. Check back later."
- Do NOT implement actual API calls — use mock data
- Animations should respect `prefers-reduced-motion`
```

---

## Prompt 3: Club Tab (Roster)

```
## Project Context

Continuing FirstBell PWA. App Shell and Inbox are complete. Now build the Club tab with roster management.

---

## High-Level Goal

Create the Club tab with:
1. Sub-navigation (Dashboard / Roster / Settings)
2. Roster view with boxer list
3. Add boxer and CSV import entry points

---

## Detailed Instructions

1. **Club Page Layout** (`app/club/layout.tsx`):
   - Sub-tabs at top: Dashboard, Roster, Settings
   - Use Shadcn Tabs component
   - Default to Roster tab for now

2. **Roster Page** (`app/club/roster/page.tsx`):
   - Search input at top (icon: `search`)
   - Action buttons row: "+ Add Boxer", "Import CSV" (icon: `file-text`)
   - Filter tabs: "Active (N)" / "Draft (N)"
   - Boxer card list below

3. **Boxer Card** (`components/cards/BoxerCard.tsx`):
   - Compact list item style
   - Left: Boxer name (bold), weight
   - Right: Record (e.g., "5W-2L"), age, status badge
   - Status badge: "Active" (green) or "Draft" (amber)
   - Action buttons on tap/hover: "View", "Find Match"

4. **Empty State**:
   - If no boxers: "Add your first boxer to start matchmaking"
   - CTA button: "+ Add Boxer"

5. **Add Boxer Modal** (`components/modals/AddBoxerModal.tsx`):
   - Form fields: Name, DOB (date picker), Weight (number), Category (select: Senior/Junior), Declared record (wins/losses inputs)
   - Save as Draft button (secondary)
   - Save & Activate button (primary)

---

## Mock Data

Add to `lib/mockData.ts`:
- 5 active boxers with varied stats
- 2 draft boxers

---

## Constraints

- Boxer cards must show essential info at a glance
- DOB field, not age (age is computed)
- Search should filter by name
- Do NOT implement CSV upload logic — just the UI trigger
```

---

## Prompt 4: Browse Tab (Club Directory)

```
## Project Context

Continuing FirstBell PWA. App Shell, Inbox, and Club tabs complete. Now build the Browse tab with club directory.

---

## High-Level Goal

Create the Browse tab with:
1. Sub-navigation (Clubs / Shows)
2. Searchable club directory
3. Club cards with claim functionality

---

## Detailed Instructions

1. **Browse Page Layout** (`app/browse/layout.tsx`):
   - Sub-tabs: Clubs, Shows
   - Default to Clubs tab

2. **Club Directory Page** (`app/browse/clubs/page.tsx`):
   - Search input: "Search clubs..."
   - Region filter dropdown: "All Regions", "North", "Midlands", "South", etc.
   - Club card list

3. **Club Card** (`components/cards/ClubCard.tsx`):
   - Club name (bold)
   - Region + status badge
   - Status badges:
     - "Claimed" (green) — show "~N boxers"
     - "Unclaimed" (gray) — show "Claim This Club" button
     - "Pending" (amber) — show "Claim Pending"
   - Tap to view club profile

4. **Club Profile Page** (`app/browse/clubs/[clubId]/page.tsx`):
   - Club name as header
   - Region, status
   - If claimed: show public boxer count, contact button (for logged-in users)
   - If unclaimed: prominent "Claim This Club" button
   - Claim triggers confirmation modal

5. **Claim Confirmation Modal** (`components/modals/ClaimClubModal.tsx`):
   - "Are you sure you want to claim [Club Name]?"
   - Explanation: "Your claim will be reviewed by an admin"
   - Confirm / Cancel buttons

---

## Mock Data

Add to `lib/mockData.ts`:
- 10 clubs: 6 claimed, 3 unclaimed, 1 pending

---

## Constraints

- Do NOT expose contact details publicly
- Search filters by club name
- Region filter is inclusive (shows all if "All")
```

---

## Prompt 5: Deep Link Proposal Response Page

```
## Project Context

FirstBell PWA. This is a standalone page accessed via deep link — no app navigation, minimal chrome.

---

## High-Level Goal

Create a standalone proposal response page that:
1. Shows proposal details
2. Allows Accept/Decline without login
3. Provides call option to contact proposer

---

## Detailed Instructions

1. **Proposal Response Page** (`app/respond/[token]/page.tsx`):
   - Minimal header: FirstBell logo only (small, centered)
   - No bottom nav or AI bar
   - Single-purpose: review and respond

2. **Proposal Summary Section**:
   - "Bout Proposal" heading
   - From: [Club Name]
   - Contact: [Person Name]
   - For: [Show Name]
   - Date: [Show Date]

3. **Boxer Comparison Component** (`components/ProposalComparison.tsx`):
   - Side-by-side or stacked (mobile) layout
   - "Your boxer" card: Name, weight, record (W-L), age
   - "vs" divider
   - "Opponent" card: Same fields
   - Visual weight/experience comparison if close

4. **Action Buttons** (stacked, full-width on mobile):
   - Accept (primary, green background, white text)
   - Decline (secondary, red outline)
   - Call Proposer (tertiary, with phone icon)

5. **Expiry Notice**:
   - "Expires in [X hours/days]" at bottom
   - If expired: show "This proposal has expired" message, disable actions

6. **States**:
   - Loading: skeleton
   - Valid: show proposal
   - Expired: show expired message
   - Already responded: show "You already [accepted/declined] this proposal"
   - Invalid token: show error

---

## Constraints

- This page must work WITHOUT authentication
- No app navigation elements
- Call button opens native dialer (`tel:` link) — do not display number directly
- Must work on mobile browsers (not just PWA)
- Accessible: large buttons, clear contrast
```

---

## Important Reminder

All AI-generated code requires:

1. **Human review** — Check for security issues, accessibility, and edge cases
2. **Testing** — Unit tests, integration tests, manual QA
3. **Refinement** — AI output is a starting point, not production code
4. **Firebase integration** — These prompts create UI only; backend calls need separate implementation

---

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2026-01-06 | 1.0 | Initial prompts generated | Sally (UX Expert) |
