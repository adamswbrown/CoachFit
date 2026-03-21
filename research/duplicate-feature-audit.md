# Duplicate Feature Audit — CoachFit Web

**Date:** 2026-03-21
**Scope:** Coach dashboard, client dashboard, challenge system, credits, classes, compliance, weekly review

---

## QUESTION 1: Duplicate Functionality Audit

### Overlap 1: Compliance Page vs Weekly Review — Client Check-in Tracking

**Feature A: `/coach-dashboard/compliance/page.tsx`**
- Shows all clients with their check-in streak (current streak, longest streak, days since last check-in)
- Categorizes clients as green/amber/red/never based on recency of check-in
- Summary cards: total clients, checked in today, missed yesterday, missed 2+ days
- Fetches from `/api/coach-dashboard/client-streaks`
- Action: "Send Encouragement" button (stub)

**Feature B: `/coach-dashboard/weekly-review/page.tsx`**
- Shows all clients with their weekly check-in count, adherence rate, weight trend, avg steps, calories, sleep
- Also fetches `/api/coach-dashboard/client-streaks` and displays streak data per client
- Also categorizes clients as red/amber/green using attention scores + adherence thresholds
- Has Loom URL, coach notes, email draft generation, questionnaire status, attention scores
- Filterable by cohort, sortable by priority/name/streak/score

**Where they overlap:**
- Both show the same green/amber/red priority for the same clients
- Both display streak data (current streak, days since last check-in)
- Both call the same `/api/coach-dashboard/client-streaks` API
- Both aim to answer: "which clients need attention right now?"

**Verdict: MERGE.** The compliance page is a strict subset of the weekly review page. The weekly review already shows streak data, priority coloring, and has richer context (attention scores, Loom, email drafts, questionnaire status). The compliance page adds nothing that the weekly review doesn't already have. The compliance page could be removed entirely, and a quick-access "attention filter" (red only) on the weekly review would replicate its value.

---

### Overlap 2: Challenge Compliance (Coach) vs Compliance Page

**Feature A: `/coach-dashboard/challenges/page.tsx`**
- Lists CHALLENGE-type cohorts the coach owns
- Expanding a challenge shows participants with check-in rate, streak, and On Track/Falling Behind/At Risk badges
- Fetches per-participant progress from `/api/challenges/[cohortId]/progress?clientId=`
- Progress is calculated from Entry records within the challenge date window

**Feature B: `/coach-dashboard/compliance/page.tsx`**
- Shows ALL clients (not challenge-specific) with streak/recency data
- Not scoped to any cohort or challenge

**Where they overlap:**
- Both track client adherence via check-in streaks
- Both use green/amber/red status indicators with similar thresholds
- Both show streak counts and "at risk" labels

**Verdict: Partially overlapping but KEEP SEPARATE.** The challenge compliance view is scoped to a specific challenge cohort and uses challenge-specific date windows from `getChallengeProgress()`. The compliance page is a global cross-cohort view. They serve different purposes — one answers "how are participants doing in this challenge?" and the other "which of ALL my clients need attention today?" However, the compliance page should be merged into the weekly review (see Overlap 1), which already has cohort filtering.

---

### Overlap 3: Coach Dashboard Main Page Client List vs Members Page vs Compliance Page

**Feature A: `/coach-dashboard/page.tsx` (main dashboard)**
- Shows all clients with adherence rate, check-in count, weight trend, last check-in date
- Filterable by: all, active, connected, pending, offline, unassigned, invited, needs-attention
- Searchable
- Shows cohort assignments

**Feature B: `/coach-dashboard/members/page.tsx`**
- Shows all gym members with last entry date, 7-day entry count, last weight
- Searchable, sortable by name/last activity/joined
- Links to individual client page

**Feature C: `/coach-dashboard/compliance/page.tsx`**
- Shows all clients with streak data and traffic light status

**Where they overlap:**
- All three show the same client list with activity/check-in recency data
- The main dashboard's "needs-attention" filter and the compliance page serve the same function
- The members page shows largely the same data as the main dashboard with a different layout

**Verdict: Three views that could be two.** The main dashboard already has filtering capabilities that cover the compliance page's use case. The members page adds a cleaner list view focused on navigation to individual clients. Recommendation: eliminate the compliance page (redundant with weekly review + main dashboard), and consider whether the members page adds enough distinct value vs the main dashboard's client list.

---

### Overlap 4: `/api/challenges` Route — Dual Purpose (Coach + Client)

**Feature A: GET `/api/challenges` for coaches/admins**
- Returns ALL challenge cohorts with member counts

**Feature B: GET `/api/challenges` for clients**
- Returns challenge cohorts the client is NOT enrolled in (available challenges)

**Where they overlap:** Same route, different behavior based on role. This is an intentional pattern, not a true duplication — the route is role-aware. **No action needed.**

---

### Overlap 5: Credit Views — Client vs Coach

**Feature A: `/client-dashboard/credits/page.tsx`**
- Client sees their own balance, can purchase credit packs, sees transaction history (ledger)

**Feature B: `/coach-dashboard/credits/page.tsx`**
- Coach sees all client balances, manages credit products, approves/rejects purchase submissions, does manual adjustments

**Where they overlap:** Minimal — they share the concept of "credits" but serve completely different roles with different data access. The client sees their own balance and buys; the coach manages all clients and approves. **No action needed — correctly separated by role.**

---

### Overlap 6: Class Schedule — Client vs Coach

**Feature A: `/client-dashboard/classes/page.tsx`**
- 14-day date strip, browse sessions, tap-to-book, cancel bookings

**Feature B: `/coach-dashboard/classes/page.tsx`**
- Week view, create/edit sessions, manage status, view booking counts

**Where they overlap:** Same underlying data (ClassSession) but completely different interactions. Client books; coach manages. **No action needed — correctly separated.**

---

### Overlap 7: Milestones Page vs Challenge Progress

**Feature A: `/coach-dashboard/milestones/page.tsx`**
- Coach creates custom milestones (streak targets, custom goals) for clients
- Tracks achievement status, allows coach messages on achieved milestones
- Separate data model (Milestone table)

**Feature B: Challenge progress (`/client-dashboard/challenges/[cohortId]/page.tsx`)**
- Shows automated progress: streak, check-in rate, days completed, weekly entries
- Progress ring, streak calendar

**Where they overlap:** Both track "streak" as a concept. Milestones could target streak achievements (e.g., "30-Day Check-In Streak"), and the challenge progress page already shows the current streak.

**Verdict: KEEP SEPARATE.** Milestones are coach-created goals that can exist outside of challenges. Challenge progress is automated tracking within a specific cohort timeframe. They complement each other — milestones could reference challenge data but they're architecturally distinct. The one improvement: milestone achievement could auto-detect from challenge progress data rather than requiring manual tracking.

---

## QUESTION 2: Weekly Review vs Challenge Compliance — Can They Be Merged?

### What Weekly Review Tracks

**Location:** `/coach-dashboard/weekly-review/page.tsx`

| Aspect | Detail |
|--------|--------|
| **Who fills it in** | Coach reviews client data; system auto-generates summaries |
| **Frequency** | Weekly (coach navigates week-by-week) |
| **Scope** | All clients across all cohorts (filterable by cohort, by coach for admins) |
| **Data shown per client** | Check-in count for the week, check-in rate, avg weight, weight trend, avg steps, avg calories, avg sleep, adherence status |
| **Coach actions** | Save Loom video URL, save text note, copy email draft, send questionnaire reminder |
| **Stored data** | `WeeklyCoachResponse` (loomUrl, note per client per week) |
| **Priority system** | Attention score (0-100) from AttentionScore model + adherence thresholds, combined into red/amber/green |
| **Additional data** | Questionnaire completion status, client streaks (current streak, days since last check-in) |
| **API sources** | `/api/coach-dashboard/weekly-summaries`, `/api/coach-dashboard/client-attention-scores`, `/api/coach-dashboard/weekly-response`, `/api/coach/weekly-questionnaire-status`, `/api/coach-dashboard/client-streaks` |

### What Challenge Compliance Tracks

**Location:** `/coach-dashboard/challenges/page.tsx` (expanded participant view)

| Aspect | Detail |
|--------|--------|
| **Who fills it in** | System auto-calculates from Entry records within challenge date range |
| **Frequency** | Real-time (on-demand when coach expands a challenge) |
| **Scope** | Single challenge cohort at a time |
| **Data shown per participant** | Check-in rate (%), streak, progress bar, On Track/Falling Behind/At Risk label |
| **Coach actions** | None (view only) |
| **Stored data** | None — calculated on the fly from `getChallengeProgress()` |
| **Priority system** | Rate >= 70% = On Track, 40-70% = Falling Behind, < 40% = At Risk |
| **API sources** | `/api/challenges` (list), `/api/cohorts/{id}/clients` (members), `/api/challenges/{id}/progress?clientId=` (per participant) |

### Are They Tracking the Same Underlying Behaviour?

**Yes, partially.** Both track whether clients are consistently checking in (submitting Entry records). But they do it from different angles:

- **Weekly review** asks: "How did this client do *this specific week*?" It compares check-ins against expected frequency, shows absolute numbers (3/7 days), and provides a coaching action surface (Loom, notes, emails).

- **Challenge compliance** asks: "How is this participant doing across the *entire challenge duration*?" It measures cumulative check-in rate (e.g., 23/42 days = 55%), current streak, and weeks-based breakdown.

The underlying signal is the same: `Entry` records by date. The timeframe and aggregation differ.

### Could a Single "Client Progress" View Replace Both?

**Partially, but not fully.** Here's why:

#### What would be GAINED by merging:
1. **Single place for coaches to assess adherence** — no jumping between weekly review and challenges page
2. **Consistent priority logic** — today, weekly review uses AttentionScore + adherence thresholds while challenges use simple rate thresholds (70%/40%). A merged view could use one consistent system.
3. **Reduced API calls** — the weekly review already fetches streaks from `/api/coach-dashboard/client-streaks`; the challenge page makes N+1 calls to `/api/challenges/{id}/progress`

#### What would be LOST by merging:
1. **Challenge-specific date framing** — `getChallengeProgress()` calculates progress within the challenge's start date and duration. The weekly review doesn't know about challenge boundaries.
2. **Challenge-specific context** — the challenge page shows challenge name, which week of how many, enrollment status. Weekly review has no concept of challenge lifecycle.
3. **Simplicity of the challenge view** — the challenge page is a focused, lightweight view. The weekly review is already feature-heavy (Loom, notes, email drafts, questionnaires, attention scores).

### Recommendation: PARTIALLY COMBINE

#### 1. Eliminate `/coach-dashboard/compliance/page.tsx` entirely
It's a strict subset of the weekly review page. The weekly review already displays streak data, priority coloring, and has far more context and actions. The compliance page adds zero unique functionality.

#### 2. Add a "Challenge Progress" column/section to the weekly review
For clients currently enrolled in a CHALLENGE cohort, when the coach filters by a challenge cohort, the weekly review could additionally show:
- Overall challenge check-in rate (from `getChallengeProgress()`)
- Challenge streak
- A small progress indicator (% complete)

This would be a new data enrichment on the existing weekly review page, not a new page.

#### 3. Keep `/coach-dashboard/challenges/page.tsx` as a lightweight management view
Strip it down to just listing challenges with enrollment counts and status (Draft/Active/Completed). Remove the participant compliance drill-down, since that information would now live in the weekly review when filtered to that challenge cohort.

### Changes Required

#### UI changes:
- Weekly review: Add an optional "Challenge Progress" mini-card per client row when viewing a CHALLENGE cohort (shows check-in rate ring, streak, % complete)
- Weekly review: Ensure cohort filter includes CHALLENGE-type cohorts (it should already)
- Remove `/coach-dashboard/compliance/page.tsx` page and its nav link
- Simplify `/coach-dashboard/challenges/page.tsx` — remove the expandable participant drill-down

#### Data model changes:
- None. `getChallengeProgress()` already exists and works. The weekly review would call it when the selected cohort is a CHALLENGE type.

#### API changes:
- Minor: The weekly review's `/api/coach-dashboard/weekly-summaries` endpoint may need to accept a `cohortId` for CHALLENGE cohorts (it likely already does based on the code showing `cohortId` param support).
- The weekly review page would additionally call `/api/challenges/{cohortId}/progress?clientId=` for each client when a challenge cohort is selected (or better: create a batch endpoint that returns progress for all participants in one call).

### Summary Table

| Page | Current Status | Recommendation |
|------|---------------|----------------|
| `/coach-dashboard/weekly-review` | Rich review queue | **KEEP** — add challenge progress enrichment |
| `/coach-dashboard/compliance` | Streak/status table | **REMOVE** — redundant with weekly review |
| `/coach-dashboard/challenges` | Challenge list + participant drill-down | **SIMPLIFY** — keep list, remove compliance drill-down |
| Challenge progress API (`getChallengeProgress`) | Per-client calculation | **KEEP** — add batch variant for weekly review |
