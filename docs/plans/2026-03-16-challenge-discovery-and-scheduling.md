# Plan: Challenge Discovery & Scheduling

**Date:** 2026-03-16
**Status:** Future — not yet scheduled for implementation
**Priority:** Medium — needed before public launch with multiple challenge cycles

## Context

Gym members can now track independently without a coach. When a coach runs a 6 or 8-week challenge, members join a cohort, complete the challenge, then return to independent tracking. Currently, adding/removing members from cohorts is manual (coach/admin does it). There's no way for a gym member to discover upcoming challenges or sign up themselves.

This plan covers the client-facing challenge discovery flow and the coach-side scheduling that enables it.

## Member Lifecycle (Current → Future)

```
Current:
  Sign up → log independently → [coach manually adds to cohort] → challenge → [coach manually removes] → independent

Future:
  Sign up → log independently → browse challenges → sign up → challenge starts → challenge ends (auto) → independent
```

## Required Changes

### 1. Cohort Scheduling Fields

Add to the `Cohort` model (schema already has `cohortStartDate`):

```prisma
model Cohort {
  // Existing fields...
  cohortStartDate    DateTime?  @db.Date   // Already exists
  cohortEndDate      DateTime?  @db.Date   // NEW — calculated from startDate + durationWeeks
  enrollmentOpen     Boolean    @default(false)  // NEW — visible to members for signup
  enrollmentDeadline DateTime?  // NEW — last day to join
  maxMembers         Int?       // NEW — capacity limit (optional)
  description        String?    // NEW — public description for the challenge listing
}
```

### 2. Challenge Listing Page (Client-Facing)

**Route:** `/challenges` (new page)

Shows all cohorts where `enrollmentOpen = true` and `enrollmentDeadline >= today`:
- Challenge name and description
- Start date, duration (weeks), end date
- Spots remaining (if maxMembers set)
- "Join Challenge" button

**Gating:**
- Must be authenticated (CLIENT role)
- Cannot join if already in a cohort (unique constraint on CohortMembership)
- Cannot join after enrollment deadline

### 3. Self-Enrollment API

**Route:** `POST /api/challenges/[id]/join` (new)

- Validates: enrollment open, deadline not passed, capacity not full, user not already in a cohort
- Creates `CohortMembership` record
- Sends confirmation email

### 4. Auto-Completion of Challenges

When a cohort's `cohortEndDate` passes:
- Option A: Cron job checks daily, sets `enrollmentOpen = false` on expired cohorts
- Option B: Coach manually "closes" the challenge
- Option C: Both — auto-close with manual override

On close:
- Members are NOT auto-removed (preserves data for review)
- Coach can bulk-remove members when ready
- Or: add a "Release Members" button that deletes all CohortMemberships for that cohort

### 5. Coach Challenge Management

Enhance cohort creation/edit to include:
- Toggle "Open for member signup"
- Set enrollment deadline
- Set max members
- Write a public description
- "Release Members" action after challenge ends

### 6. Client Dashboard Integration

When `enrollmentOpen` challenges exist, show a card on the client dashboard:
> "A new challenge is starting! [View challenges →](/challenges)"

Only shown when the member is NOT currently in a cohort.

## What Already Works

- Cohort CRUD (create, edit, delete)
- `cohortStartDate` field exists
- `durationWeeks` field exists
- CohortMembership join/leave
- Coach can view all members via Gym Members page
- Entry data persists across cohort membership changes

## Dependencies

- None — this is additive, no breaking changes to existing flows

## Estimated Effort

| Component | Hours |
|-----------|-------|
| Schema migration (new fields) | 1 |
| Challenge listing page | 4 |
| Self-enrollment API | 2 |
| Coach challenge management UI | 4 |
| Client dashboard challenge card | 1 |
| Auto-completion logic | 2 |
| Testing | 2 |
| **Total** | **~16 hours** |

## Open Questions (For Later)

1. Should members be auto-removed when a challenge ends, or should coaches manually release them?
2. Should there be a waiting list if a challenge is full?
3. Should members be able to leave a challenge early?
4. Should past challenges be visible (archive view)?
5. Payment integration — will challenge signup require payment?
