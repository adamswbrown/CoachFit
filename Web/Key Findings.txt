Key Findings
Industry consensus across Mindbody, Glofox, TeamUp, Gymdesk, and WellnessLiving — they all use the same core patterns:

Data Model (Template + Instance)
Class Template — the definition (HIIT, Core Strength, etc.) with default capacity, credit cost, booking windows, cancel cutoffs
Class Session — individual occurrence with optional overrides (different instructor, capacity)
Booking — the join between member and session, tracks full lifecycle (BOOKED → ATTENDED/NO_SHOW/CANCELLED/LATE_CANCEL)
Booking Flow
Credits deducted at booking time, not attendance (universal pattern)
Cancel before cutoff → full credit refund
Cancel after cutoff → no refund (LATE_CANCEL)
No-show → no refund, optionally penalized
Waitlist (TeamUp has the best model)
Auto-promotion zone: >24h before class → auto-book the next waitlisted member
Manual claim zone: <24h before class → send notification with 30-min claim window
Nightly blackout: pause waitlist notifications 10pm-6am
Credit System
Membership tier → monthly credit allocation (cron job)
Ledger-based tracking (append-only, balance is denormalized sum)
Rollover options: none, capped to monthly amount, or unlimited
Good News
Your Prisma schema already has ClassTemplate, ClassSession, ClassBooking, CreditProduct, ClientCreditAccount, ClientCreditSubscription, and ClientCreditLedger models defined. The data model is solid — it's the application layer (API routes, booking logic, waitlist engine, frontend) that needs building.

What's Missing
RecurrenceRule model for auto-generating weekly sessions
Waitlist claim window fields on ClassBooking
Rollover policy config on CreditProduct
Want me to save this as a project memory and start planning the implementation, or do you want to review the full research first? You can also provide the membership tier → credits mapping table whenever you're ready.

i also want you look at patterns for Challanges - these are the 6/8 week events that clients sign up to (and become part of a cohort) - these are in addtion to your normal classes, and essentailly are the main use of the ios app (although non co ort memebers would also use it)
Agent:Research gym challenge/programme patterns
IN
Research how gym and fitness platforms handle time-bound challenges/programmes (e.g. 6-week transformation, 8-week bootcamp). This is for the CoachFit platform which already has a concept of "Cohorts" (groups of clients managed by a coach with check-ins, weekly reviews, questionnaires).

The context: Challenges are the MAIN revenue driver for this gym. Clients sign up to a 6 or 8 week programme, get assigned to a cohort, use the iOS app for daily check-ins (weight, calories, steps, sleep, perceived effort), and coaches review their progress weekly. The gym also has regular group classes (HIIT, Core, etc.) that are separate from challenges but challenge participants may get priority/included access.

Research these specific areas:

1. **Challenge Structure & Lifecycle**: How do platforms like Mindbody, Glofox, TeamUp, Gymdesk, WellnessLiving, and dedicated challenge platforms (e.g. Habitify, Stridekick, MBO challenges) structure time-bound programmes? What's the lifecycle: announcement → registration → active → completion → results? How do they handle cohort-based vs rolling-start challenges?

2. **Registration & Payment**: How do clients sign up for challenges? Is it a separate purchase from memberships? Do challenges have their own pricing independent of class packs? Early-bird pricing? Capacity limits? Waitlists?

3. **Challenge Content & Milestones**: What content/structure do platforms provide within a challenge? Daily tasks, weekly goals, milestone markers, leaderboards, progress photos, measurements tracking? How do they keep participants engaged over 6-8 weeks?

4. **Progress Tracking & Accountability**: How do platforms track participant progress during a challenge? Daily check-ins, weekly weigh-ins, body measurements, before/after photos? How is compliance/adherence tracked? What happens with non-compliant participants?

5. **Coach/Admin Management**: How do coaches manage challenge cohorts? Bulk communications, progress dashboards, intervention triggers for at-risk participants, weekly review workflows?

6. **Results & Completion**: How are challenge results calculated and presented? Leaderboards (% body weight lost, most consistent, most improved)? Certificates/badges? Before/after galleries? How do platforms handle the transition from challenge completion to ongoing membership?

7. **Challenge + Regular Classes Integration**: How do challenges interact with regular gym class schedules? Do challenge participants get included classes? Reserved spots? Special challenge-only classes?

8. **Retention & Re-enrollment**: How do platforms handle post-challenge retention? Auto-enrollment into the next challenge? Alumni groups? Maintenance programmes?

Also look at:
- CrossFit box challenge patterns (CrossFit Open, in-house challenges)
- F45 challenge structure (the 8-week challenge is their signature product)
- Barry's Bootcamp / Orangetheory challenge programmes
- Transform HQ / BodyBoss type online challenge platforms

Evaluate how CoachFit's existing Cohort system (CohortMembership, Entries, CoachNotes, WeeklyQuestionnaireResponse, Streak tracking) maps to these patterns and what gaps exist.

This is RESEARCH ONLY — do not write any code.
Researching challenge/programme patterns in the background — looking at F45's 8-week challenge, CrossFit Open, Orangetheory, Transform HQ, plus how Mindbody/Glofox/TeamUp handle time-bound programmes. Will map it all against your existing Cohort system.

I'll share the findings when it's done. Anything else in the meantime?

The challenge research is done. Here's the key findings:

Challenge Patterns (F45, Orangetheory, CrossFit, Barry's)
Universal Lifecycle
Announcement → Registration → Onboarding/Baseline → Active (6-8 weeks) → Completion → Results → Post-Challenge

What the Industry Does
F45's 8-Week Challenge (the gold standard):

3 phases: "Spring Training" (weeks 1-2), "Regular Season" (3-6), "World Series" (7-8)
Meal plans released 1 week before Day 1
Full body scan at start, midpoint, and end
App-first with daily tracking (water, sleep, meal compliance, workout attendance)
Orangetheory:

$25-$35 registration fee on top of membership
InBody scans at baseline, week 4, week 8
Participants choose a scoring track (fat loss vs muscle gain)
Minimum 3 workouts/week for 6 of 8 weeks to qualify
$500 studio prize, $5,000 regional
CrossFit:

Quarterly challenge cadence = predictable revenue
Registration fee converts to membership credit (acquisition tool)
Intramural team format creates micro-communities within the challenge
CoachFit's Position
What you already have (strong foundation):

Cohorts with coaches, members, dates, duration
Daily check-ins (weight, steps, calories, sleep, stress, macros)
Streak tracking + compliance dashboard (green/amber/red)
Weekly questionnaires + coach notes
HealthKit workout + sleep tracking
Milestones (streak-based)
Class booking with cohort-scoped classes
Critical gaps (ordered by revenue impact):

Challenge lifecycle — no status (DRAFT → REGISTRATION_OPEN → ACTIVE → COMPLETED), no registration window, no phases
Self-registration — currently invite-only, no public signup page
Baseline/final measurements — no dedicated measurement capture separate from daily entries, no before/after photos
Completion tracking — no per-participant status (completed/dropped/disqualified), no minimum criteria
Leaderboards — no ranking engine (% weight change, consistency, most improved)
CohortMembership history — the @@unique([userId]) constraint means a user can only be in ONE cohort, blocking challenge-to-challenge transitions
Payment — no pricing on challenges, no early-bird, no bundled class credits
Challenge templates — no way to reuse config for recurring seasonal challenges
Biggest Architectural Issue
The @@unique([userId]) on CohortMembership is the single biggest constraint. Every platform keeps challenge history (alumni tracking, before/after galleries, re-enrollment). Options:

Add a status field and only enforce uniqueness on active memberships
Or create a separate ChallengeParticipation model
Want me to save both research reports (class scheduling + challenges) to memory and start planning the implementation? You mentioned you'd provide the membership tier → credits mapping table too.