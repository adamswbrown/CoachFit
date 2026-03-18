# Plan: Streak System, Coach Compliance Dashboard & Personalised Milestones

**Date**: 2026-03-18
**Status**: Ready for implementation
**Branch**: `mobile-react`
**Based on**: [Competitor Analysis Research](../research/2026-03-18-competitor-analysis-retention-features.md)

---

## What We're Building

Three interlocking features:

1. **Client-facing streak counter** (mobile) — consecutive check-in days shown on home screen
2. **Coach compliance dashboard** (web) — per-client streak + compliance rate with 1-day missed check-in alerts
3. **Personalised milestones** (both) — coach-defined goals that trigger celebrations when met

---

## Part 1: Client Streak Counter (Mobile)

### What the client sees

- Home screen shows current streak: "5-day streak" with a flame/number visual
- Milestone celebrations at 7, 14, 30, 60, 90 days (simple overlay animation)
- Streak resets if a day is missed (based on Entry records for the client)
- Coach milestone cards appear inline when coach sends a personalised message

### Implementation

**New service**: `React/src/services/streak.ts`
- `getStreak(clientId)` — calls `GET /api/client/streak` on the platform
- Returns: `{ currentStreak: number, longestStreak: number, lastCheckInDate: string, milestones: Milestone[] }`

**New API endpoint**: `Web/app/api/client/streak/route.ts`
- Calculates streak from Entry table: count consecutive days backwards from today where an entry exists
- Fetch any pending milestones from a new `Milestone` table
- Auth: device token (ingest auth) or Clerk session

**New component**: `React/src/components/StreakBanner.tsx`
- Shows on HomeScreen above action buttons
- Displays current streak number, flame icon, and "day streak" text
- At milestones (7/14/30/60/90): shows celebration card with confetti-style visual
- Tappable to see longest streak and milestone history

**New component**: `React/src/components/MilestoneCard.tsx`
- Renders coach milestone messages (personalised congratulations)
- Shown on home screen feed below streak banner

### Streak Calculation Logic

```
Start from today, walk backwards:
  - If entry exists for today → streak starts at 1
  - If no entry today but entry yesterday → streak starts from yesterday
  - Count consecutive days with entries
  - Stop at first gap
Return { currentStreak, longestStreak }
```

Note: "today" is forgiven until end of day — if it's 2pm and no check-in yet, the streak isn't broken. The streak only breaks at midnight if no entry exists for the previous day.

---

## Part 2: Coach Compliance Dashboard (Web)

### What the coach sees

Enhance the existing weekly review and coach dashboard with:

1. **Compliance column** on client list — shows streak count + 7-day check-in rate
2. **1-day alert** — clients who missed yesterday's check-in are flagged AMBER; 2+ days = RED
3. **At-risk panel** — top of coach dashboard showing clients needing attention, sorted by days since last check-in
4. **Quick action** — tap client to send an encouragement message (uses existing email infrastructure)

### Implementation

**Modify**: `Web/lib/admin/attention.ts`
- Add streak calculation to `calculateUserScoreFromData()`
- Change alert threshold: 1 missed day = AMBER (+15 points), 2+ missed days = RED (+30 points)
- Include `currentStreak` and `daysSinceLastCheckIn` in score metadata

**New API endpoint**: `Web/app/api/client/streak/route.ts`
- `GET /api/client/streak` — returns streak for authenticated client (mobile)
- `GET /api/coach-dashboard/client-streaks/route.ts` — returns streaks for all coach's clients (web)

**Modify**: `Web/app/coach-dashboard/weekly-review/page.tsx`
- Add streak column to client table
- Add "days since last check-in" indicator
- Colour code: GREEN (checked in today/yesterday), AMBER (1 day missed), RED (2+ days missed)

**New component**: `Web/app/coach-dashboard/at-risk/page.tsx` (or panel on existing dashboard)
- List of clients sorted by days since last check-in (descending)
- Quick "Send Encouragement" button per client
- Uses existing email send infrastructure

---

## Part 3: Personalised Milestones (Both Platforms)

### What coaches can do

- Define custom milestones per client or per cohort
- Examples: "7 consecutive days under 2000 cal", "First week hitting 8000 steps daily", "30-day check-in streak"
- When a client achieves one, the coach gets notified and can send a personalised congratulatory message
- The message appears as a special card in the client's mobile app

### Implementation

**New Prisma model**: `Milestone`
```prisma
model Milestone {
  id          String   @id @default(uuid())
  coachId     String
  clientId    String?  // null = applies to entire cohort
  cohortId    String?  // null = applies to specific client
  title       String   // "30-Day Streak"
  description String?  // "Check in every day for 30 days"
  type        String   // "streak" | "custom"
  targetValue Int?     // e.g. 30 for a 30-day streak
  achievedAt  DateTime?
  message     String?  // Coach's personalised congratulation
  createdAt   DateTime @default(now())

  coach       User     @relation("MilestoneCoach", fields: [coachId], references: [id])
  client      User?    @relation("MilestoneClient", fields: [clientId], references: [id])
  cohort      Cohort?  @relation(fields: [cohortId], references: [id])
}
```

**Auto-milestones**: System-defined streak milestones (7/14/30/60/90 days) are created automatically. When a client's streak hits the threshold, `achievedAt` is set and the coach is notified.

**Coach milestone creation**: `POST /api/coach-dashboard/milestones`
- Coach defines title, target, applies to client or cohort
- API checks achievement status on each check-in

**Milestone check**: Run on each `POST /api/ingest/entry` (check-in submission)
- Calculate current streak
- Check against pending milestones for this client
- If achieved: set `achievedAt`, create notification for coach

**Mobile milestone feed**: `GET /api/client/milestones`
- Returns achieved milestones with coach messages
- Rendered as `MilestoneCard` components on home screen

---

## Data Flow

```
Client submits check-in (mobile)
  -> POST /api/ingest/entry
  -> Backend: calculate streak
  -> Backend: check milestones (auto + custom)
  -> If milestone achieved:
    -> Set achievedAt
    -> Flag for coach notification
  -> Return streak in response

Coach views dashboard (web)
  -> GET /api/coach-dashboard/client-streaks
  -> See all clients with streaks, compliance rates, days since check-in
  -> Clients missing 1+ day flagged
  -> Coach sends encouragement or milestone congrats

Client opens app (mobile)
  -> GET /api/client/streak
  -> Display streak banner
  -> GET /api/client/milestones
  -> Display achieved milestone cards with coach messages
```

---

## Files to Create/Modify

### Mobile (React Native)

| Action | File | Purpose |
|--------|------|---------|
| Create | `src/services/streak.ts` | Streak + milestone API calls |
| Create | `src/components/StreakBanner.tsx` | Home screen streak display |
| Create | `src/components/MilestoneCard.tsx` | Coach milestone message card |
| Modify | `src/screens/HomeScreen.tsx` | Add StreakBanner + MilestoneCards |

### Web (Next.js)

| Action | File | Purpose |
|--------|------|---------|
| Create | `app/api/client/streak/route.ts` | Client streak endpoint |
| Create | `app/api/coach-dashboard/client-streaks/route.ts` | Coach streaks overview |
| Create | `app/api/coach-dashboard/milestones/route.ts` | CRUD for milestones |
| Create | `app/api/client/milestones/route.ts` | Client milestone feed |
| Modify | `prisma/schema.prisma` | Add Milestone model |
| Modify | `lib/admin/attention.ts` | 1-day alert threshold |
| Modify | `app/coach-dashboard/weekly-review/page.tsx` | Add streak + compliance columns |
| Modify | `app/api/ingest/entry/route.ts` | Trigger milestone check on check-in |

### Database Migration

- Add `Milestone` table
- Run `npx prisma migrate dev --name add-milestones`

---

## Implementation Order

1. **Streak calculation + API** (web) — the foundation everything else depends on
2. **1-day alert threshold** (web) — modify existing attention scoring
3. **Milestone model + migration** (web) — database schema
4. **Streak banner** (mobile) — client-facing streak display
5. **Coach compliance columns** (web) — add streaks to weekly review
6. **Milestone CRUD** (web) — coach creates milestones
7. **Milestone check on check-in** (web) — auto-trigger on entry submission
8. **Milestone cards** (mobile) — client sees achievements

---

## Rollback

- Milestone table can be dropped with a reverse migration
- Attention scoring threshold change is a single constant edit
- Mobile components are additive (no existing features removed)
- All new API endpoints are isolated (no changes to existing endpoints except ingest/entry milestone trigger)

---

## Success Criteria

- Client sees their streak on the home screen within 1 second of app load
- Coach sees all client streaks and compliance on the weekly review page
- Clients missing 1 day are flagged AMBER, 2+ days flagged RED
- Coach can create a milestone and the client sees it when achieved
- Streak survives app reinstall (calculated server-side from Entry history)
