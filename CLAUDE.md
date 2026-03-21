## Research Pack
All product research is in `/Users/adambrown/Developer/CoachFit/research/`.
Read ALL files in this folder before starting any feature work.

Key files:
- `researchpack-class-credit-challenge.md` — current state, schema analysis, Hitsona real data
- `implementation-plan-all-phases.md` — phased build plan (credits → booking → challenges)
- `revolut-payments-research.md` — Revolut Merchant API, webhooks, fee structure
- `ui-ux-evaluation.md` — full UX patterns for class scheduling, booking, credits UI
- `hr-platform-research.docx` — heart rate platform migration research
- `teamupdata.json` — 1,179 real TeamUp events from Hitsona Bangor (used for class session seeding)

## Project Stack
Next.js 15, React 19, TypeScript, Prisma 6.3/PostgreSQL, Clerk (managed auth), Tailwind CSS 4, shadcn/ui.
Multi-role: clients (iOS primary), coaches (tablet/desktop), admins (desktop).

## Implementation Status

### Phase 1: Credit System — COMPLETE
- `lib/credits.ts` — debitCredits, refundCredits, creditTopup, getBalance, adjustCredits, processSubmission
- `lib/validations/credits.ts` — Zod schemas
- 11 API routes under `/api/credits/`
- Client credits page, coach credit management, admin credit overview
- Hitsona credit products seeded from real TeamUp membership data

### Phase 2: Class Scheduling & Booking — COMPLETE
- `lib/booking.ts` — createBooking (atomic credit debit), cancelBooking (refund before cutoff), getAvailableSlots, getClientBookings
- `lib/class-schedule.ts` — createClassSession, bulkCreateSessions, getSchedule
- `lib/validations/booking.ts` — Zod schemas
- 8 API routes under `/api/classes/` (schedule, book, bookings, sessions, templates)
- Client: 14-day date strip schedule, tap-to-book, bookings list
- Coach: week view, session management
- 3 class types seeded: HIIT, CORE, Strength (from TeamUp data + programmatic)

### Phase 3: Challenge Lifecycle — COMPLETE
- `lib/challenges.ts` — enrollInChallenge, completeChallenge, getChallengeProgress, getActiveChallenges, getChallengeHistory
- `lib/validations/challenges.ts` — Zod schemas
- 5 API routes under `/api/challenges/`
- Client: challenge list, progress ring, streak calendar
- Coach: challenge management with participant compliance grid

### Hitsona Instructor Map
| Name | CoachFit UUID | TeamUp Staff ID |
|------|--------------|-----------------|
| Gav Cunningham | 892d7443-2b1b-4b0b-83e5-a0a477862234 | 111554 |
| Rory Stephens | 866eed7d-91b5-4dbb-b7d4-1421de65bf4a | 139862 |
| Clare Cuming | 7f133cf9-316d-4e39-8c68-c9d2599ac5fe | 145825 |
| Josh Bunting | 7c6db9b1-192a-437a-9e47-a258e223a5c2 | 158454 |
