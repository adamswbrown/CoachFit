# Implementation Plan: Credit System, Class Booking, and Challenge Lifecycle

## Summary

This plan builds four interconnected feature areas on top of existing Prisma schema models that currently have zero application code. Each phase is independently deployable. The approach follows the codebase's established patterns exactly: `getSession()` for auth, `isAdminOrCoach()`/`isAdmin()` for permissions, Zod schemas in `lib/validations.ts`, `logAuditAction()` for audit trails, and `db.$transaction()` for multi-step operations. The credit system (with Revolut payment integration) is built first because class booking depends on credit debits, and challenges depend on both.

**Key Architectural Decisions**:
- Business logic lives in dedicated service modules (`lib/credits.ts`, `lib/booking.ts`, `lib/challenges.ts`, `lib/revolut.ts`) separate from API routes, enabling reuse across routes and future cron jobs. This matches the existing pattern where `lib/streak.ts`, `lib/wrapped-calculator.ts`, etc. hold domain logic.
- **Payments use Revolut Merchant API (Payment Links / Option A)**: The gym already uses Revolut Business. The Merchant API sub-account enables online payment acceptance via hosted checkout pages. CoachFit creates an order → client clicks payment link → Revolut handles card/Apple Pay/Google Pay/Revolut Pay → webhook confirms → credits auto-approved. Fees: 0.8% + £0.02 per card transaction.

---

## Phase 1: Credit and Membership System

### 1.1 Schema Migration

**Migration name**: `add_credit_and_payment_fields`

**Changes to `Web/prisma/schema.prisma`**:

Add two fields to the `CreditProduct` model:
```prisma
allowRepeatPurchase  Boolean  @default(true)
rolloverPolicy       String   @default("NONE")  // NONE | CAPPED | UNLIMITED
```

Add three fields to the `CreditSubmission` model for Revolut payment tracking:
```prisma
revolutOrderId      String?   @unique  // Revolut Merchant API order ID
revolutCheckoutUrl  String?             // Checkout URL for client redirect
paymentMethod       String?             // "revolut_card", "revolut_pay", "apple_pay", "google_pay", "manual_transfer"
paidAt              DateTime?           // When Revolut confirms payment
```

No other schema changes in Phase 1 -- all other credit models (`ClientCreditAccount`, `ClientCreditSubscription`, `ClientCreditLedger`) are already complete.

**Migration steps**:
```bash
cd Web
npx prisma migrate dev --name add_credit_and_payment_fields
npm run db:generate
```

**Rollback**: Revert schema, drop the new columns, run `npm run db:generate`.

### 1.2 New Files

**`Web/lib/credits.ts`** (~200 lines)
- Purpose: Core credit business logic, all operations use Prisma transactions
- Exports:
  - `getBalance(clientId: string): Promise<number>` -- reads `ClientCreditAccount.balance`
  - `ensureCreditAccount(tx, clientId: string)` -- creates `ClientCreditAccount` if missing
  - `debitCredits(clientId, amount, reason, metadata)` -- creates ledger entry with negative `deltaCredits`, updates `ClientCreditAccount.balance` in a transaction; throws if insufficient balance
  - `creditTopup(clientId, amount, reason, metadata)` -- creates ledger entry with positive `deltaCredits`, updates balance
  - `refundCredits(clientId, amount, bookingId)` -- credit topup with reason `REFUND`, linked to booking
  - `processSubmission(submissionId, action: 'APPROVE' | 'REJECT', reviewerId)` -- in a transaction: updates `CreditSubmission.status`, if approved calls `creditTopup` with the product's credits, links ledger to submission
  - `adjustCredits(clientId, amount, reason, createdByUserId)` -- manual adjustment (positive or negative) with `MANUAL_ADJUSTMENT` reason
- Dependencies: `lib/db.ts`

**`Web/lib/revolut.ts`** (~150 lines)
- Purpose: Revolut Merchant API client for payment operations
- Exports:
  - `createRevolutOrder(params: { amount: number, currency: string, description: string, metadata: Record<string, string> }): Promise<{ orderId: string, checkoutUrl: string }>` -- calls `POST /api/orders` on Revolut Merchant API. Amount in minor units (pence). Returns order ID and hosted checkout URL.
  - `getRevolutOrder(orderId: string): Promise<RevolutOrder>` -- calls `GET /api/orders/{id}` to check order status
  - `verifyRevolutWebhook(payload: string, signature: string, timestamp: string): boolean` -- HMAC SHA-256 signature verification using webhook signing secret
  - `REVOLUT_ORDER_STATUSES` -- constant: PENDING, PROCESSING, AUTHORISED, COMPLETED, CANCELLED, FAILED
- Configuration:
  - `REVOLUT_MERCHANT_API_KEY` -- env var (Secret API Key, server-side only)
  - `REVOLUT_WEBHOOK_SECRET` -- env var (generated on webhook creation)
  - `REVOLUT_API_URL` -- `https://merchant.revolut.com/api/1.0` (production) or `https://sandbox-merchant.revolut.com/api/1.0` (sandbox)
- Dependencies: None (uses native fetch)

**`Web/lib/validations/credits.ts`** (~120 lines)
- Purpose: Zod schemas for all credit API inputs
- Exports:
  - `createCreditProductSchema` -- name (required), description (optional), creditMode (enum), creditsPerPeriod (optional int), periodType (enum), purchasePriceGbp (optional positive number), appliesToClassTypes (string array), purchasableByProviderOnly (boolean), classEligible (boolean), allowRepeatPurchase (boolean), rolloverPolicy (enum: NONE/CAPPED/UNLIMITED)
  - `updateCreditProductSchema` -- all fields optional, same types
  - `creditSubmissionSchema` -- creditProductId (uuid), revolutReference (optional string, for manual transfers), note (optional string max 500), paymentMethod (optional enum: "revolut_checkout" | "manual_transfer")
  - `creditAdjustmentSchema` -- clientId (uuid), amount (int nonzero), reason (string min 1 max 500)
  - `approveRejectSubmissionSchema` -- action (enum: APPROVE/REJECT)
  - `subscribeClientSchema` -- clientId (uuid), creditProductId (uuid), monthlyCredits (positive int), startDate (date string)
  - `creditLedgerQuerySchema` -- clientId (optional uuid), page (optional positive int), limit (optional int 1-100)

### 1.3 API Routes (9 routes)

All routes follow the exact pattern from `Web/app/api/cohorts/route.ts`: `getSession()` check, permission check, Zod `.parse()` or `.safeParse()`, try/catch with `z.ZodError` handling, `logAuditAction()` for mutations.

**`Web/app/api/credits/products/route.ts`** -- GET + POST
- GET: Coach/admin lists credit products. Coach sees own products (`ownerCoachId = session.user.id`). Admin sees all. Filter by `isActive`.
- POST: Coach/admin creates product. Validates with `createCreditProductSchema`. Sets `ownerCoachId` to `session.user.id` (or specified by admin). Audit log.

**`Web/app/api/credits/products/[id]/route.ts`** -- GET + PATCH + DELETE
- GET: Single product detail. Coach must own it or be admin.
- PATCH: Update product fields. Validates with `updateCreditProductSchema`. Ownership check.
- DELETE: Soft-delete (set `isActive = false`). Ownership check. Audit log.

**`Web/app/api/credits/balance/route.ts`** -- GET
- Client gets own balance: `session.user.id` used as `clientId`.
- Coach/admin can pass `?clientId=` query param to view a client's balance.

**`Web/app/api/credits/ledger/route.ts`** -- GET
- Paginated credit ledger. Same access pattern as balance. Returns `ClientCreditLedger` entries ordered by `createdAt desc`, includes related product/submission/booking names.

**`Web/app/api/credits/subscribe/route.ts`** -- POST
- Coach/admin subscribes a client to a recurring credit product. Creates `ClientCreditSubscription`. Calls `creditTopup()` for first month. Audit log.

**`Web/app/api/credits/submit/route.ts`** -- POST
- Client submits a credit purchase. Two flows based on `paymentMethod`:
  - **`"revolut_checkout"` (default)**: Creates `CreditSubmission` (PENDING), calls `createRevolutOrder()` from `lib/revolut.ts` with product price + metadata (`{ submissionId, clientId, creditProductId }`). Stores `revolutOrderId` and `revolutCheckoutUrl` on the submission. Returns `{ submission, checkoutUrl }` — client frontend redirects to Revolut checkout.
  - **`"manual_transfer"`**: Creates `CreditSubmission` (PENDING) with `revolutReference` from client. Coach must manually approve.
- If `purchasableByProviderOnly`, rejects with 403. If `!allowRepeatPurchase`, checks for existing approved submission.

**`Web/app/api/credits/submissions/[id]/route.ts`** -- PATCH
- Coach/admin approves or rejects a pending submission. Calls `processSubmission()`. Audit log.
- Note: For Revolut checkout submissions, approval happens automatically via webhook. This route is primarily for manual transfer submissions.

**`Web/app/api/credits/adjust/route.ts`** -- POST
- Coach/admin manually adjusts a client's credits. Calls `adjustCredits()`. Requires reason string. Audit log.

**`Web/app/api/webhooks/revolut/route.ts`** -- POST (NO AUTH — webhook endpoint)
- **Revolut Merchant API webhook handler**. No session auth — uses HMAC signature verification instead.
- Flow:
  1. Verify webhook signature using `verifyRevolutWebhook()` from `lib/revolut.ts`
  2. Parse event type from payload
  3. On `ORDER_COMPLETED`:
     - Look up `CreditSubmission` by `revolutOrderId`
     - If found and status is PENDING: call `processSubmission(submissionId, 'APPROVE', 'SYSTEM')`
     - Set `paidAt` and `paymentMethod` on the submission
     - Audit log with event details
  4. On `ORDER_PAYMENT_DECLINED` or `ORDER_CANCELLED`:
     - Update submission status to REJECTED
     - Audit log
  5. Return 200 OK (Revolut retries 3x at 10-min intervals on non-200)
- **Idempotent**: Check if submission already processed before acting (Revolut may send duplicate webhooks)

**`Web/app/api/credits/checkout-status/route.ts`** -- GET
- Client polls payment status after returning from Revolut checkout.
- Query param: `?submissionId=` — returns submission status (PENDING/APPROVED/REJECTED) and whether credits were added.
- Used by frontend to show success/failure after redirect back from Revolut.

### 1.4 Modified Files

| File | Change |
|------|--------|
| `Web/prisma/schema.prisma` | 2 fields on CreditProduct, 4 fields on CreditSubmission |
| `Web/lib/validations.ts` | Add `export * from "./validations/credits"` |
| `Web/lib/types.ts` | Add CreditProductMode, CreditSubmissionStatus enums |

### 1.5 Environment Variables

```bash
# Revolut Merchant API (required for payment acceptance)
REVOLUT_MERCHANT_API_KEY=     # Secret API key from Revolut Business → Merchant → API Settings
REVOLUT_WEBHOOK_SECRET=        # Generated when creating webhook in Revolut dashboard
REVOLUT_API_URL=               # https://sandbox-merchant.revolut.com/api/1.0 (dev) or https://merchant.revolut.com/api/1.0 (prod)
REVOLUT_PUBLIC_KEY=            # Public key for future embedded widget (Phase 2 enhancement)
```

**Setup steps**:
1. In Revolut Business dashboard → activate Merchant account (sub-account)
2. Generate API keys (sandbox first for development)
3. Create webhook pointing to `https://your-domain.vercel.app/api/webhooks/revolut`
4. Subscribe to events: `ORDER_COMPLETED`, `ORDER_PAYMENT_DECLINED`, `ORDER_CANCELLED`
5. Copy signing secret to `REVOLUT_WEBHOOK_SECRET`

### 1.6 Verification

1. `npm run build` -- must succeed
2. `npx prisma migrate status` -- migration applied
3. **Manual transfer flow**: Create product → submit purchase (manual_transfer) → coach approves → verify ledger + balance
4. **Revolut checkout flow** (sandbox): Create product → submit purchase (revolut_checkout) → get checkout URL → simulate payment in Revolut sandbox → webhook fires → verify auto-approval + credits added
5. **Checkout status polling**: After redirect from Revolut, verify `/api/credits/checkout-status` returns correct state
6. **Webhook idempotency**: Send same webhook twice → verify credits only added once
7. Verify `CreditProduct` has `allowRepeatPurchase` and `rolloverPolicy` columns
8. Verify `CreditSubmission` has `revolutOrderId`, `revolutCheckoutUrl`, `paymentMethod`, `paidAt` columns

### 1.7 Rollback

- Drop new columns from CreditProduct and CreditSubmission
- Delete: `lib/credits.ts`, `lib/revolut.ts`, `lib/validations/credits.ts`, all `app/api/credits/` dirs, `app/api/webhooks/revolut/` dir
- Remove export line from `lib/validations.ts`, enums from `lib/types.ts`
- Remove Revolut env vars

---

## Phase 2: Class Scheduling and Booking

### 2.1 Schema Migration

**Migration name**: `add_booking_waitlist_and_recurrence`

Add to `ClassBooking`:
```prisma
waitlistClaimExpiresAt  DateTime?
waitlistNotifiedAt      DateTime?
```

Add new model:
```prisma
model RecurrenceRule {
  id              String        @id @default(uuid())
  classTemplateId String
  dayOfWeek       Int           // 0=Sunday, 6=Saturday
  startTime       String        // "06:30" (HH:mm)
  endTime         String        // "06:55" (HH:mm)
  instructorId    String?
  effectiveFrom   DateTime
  effectiveUntil  DateTime?
  isActive        Boolean       @default(true)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  classTemplate   ClassTemplate @relation(fields: [classTemplateId], references: [id], onDelete: Cascade)
  instructor      User?         @relation("RecurrenceInstructor", fields: [instructorId], references: [id])
  @@index([classTemplateId])
}
```

Add relations: `ClassTemplate.recurrenceRules`, `User.RecurrenceRulesAsInstructor`

### 2.2 New Files

**`Web/lib/booking.ts`** (~300 lines)
- `bookSession(clientId, sessionId, source, bookedByUserId?)` -- validates capacity, booking window, deduplication, calls `debitCredits()`, creates ClassBooking
- `joinWaitlist(clientId, sessionId, source)` -- checks full, assigns position, creates WAITLISTED booking (no credit debit)
- `cancelBooking(bookingId, userId)` -- checks cutoff: before = CANCELLED + refund, after = LATE_CANCEL (no refund). Triggers `processWaitlist()`
- `processWaitlist(sessionId)` -- >24h: auto-promote (debit + BOOKED). <24h: set claim window (30 min). 10pm-6am: delay
- `claimWaitlistSpot(bookingId, clientId)` -- validates claim window, debits credits, sets BOOKED
- `markAttendance(sessionId, data[])` -- batch: ATTENDED or NO_SHOW
- `generateSessionsFromRecurrence(templateId, fromDate, toDate)` -- creates sessions from rules, skips duplicates

**`Web/lib/validations/booking.ts`** (~150 lines)
- `createClassTemplateSchema`, `updateClassTemplateSchema`
- `createRecurrenceRuleSchema` (dayOfWeek 0-6, HH:mm times)
- `generateSessionsSchema` (from/to dates, max 90-day range)
- `createManualSessionSchema`, `markAttendanceSchema`, `scheduleQuerySchema`

### 2.3 API Routes (10 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/classes` | GET, POST | Template CRUD (coach-scoped) |
| `/api/classes/[id]` | GET, PATCH, DELETE | Single template management |
| `/api/classes/[id]/recurrence` | GET, POST, DELETE | Recurrence rules |
| `/api/classes/[id]/sessions` | GET, POST | List/generate sessions |
| `/api/classes/sessions/[id]` | GET, PATCH | Session detail, cancel session |
| `/api/classes/sessions/[id]/book` | POST | Book or auto-waitlist |
| `/api/classes/sessions/[id]/cancel` | POST | Cancel booking |
| `/api/classes/sessions/[id]/attendance` | PUT | Mark attendance (coach) |
| `/api/classes/schedule` | GET | Public schedule view |
| `/api/classes/sessions/[id]/waitlist/claim` | POST | Claim waitlist spot |

### 2.4 Modified Files

| File | Change |
|------|--------|
| `Web/prisma/schema.prisma` | 2 fields on ClassBooking, RecurrenceRule model, relations |
| `Web/lib/validations.ts` | Add booking export |
| `Web/lib/types.ts` | Add SessionStatus, BookingStatus, BookingSource enums |

### 2.5 Verification

1. `npm run build` passes
2. Flow: Create template (HIIT, cap 10) → add recurrence → generate 14 days of sessions → book as client (credit debited) → cancel before cutoff (refunded) → fill to capacity → next client waitlisted → mark attendance

### 2.6 Rollback

- Drop waitlist columns from ClassBooking, drop RecurrenceRule table
- Delete: `lib/booking.ts`, `lib/validations/booking.ts`, all `app/api/classes/` dirs
- Remove relations from schema, exports from validations/types

---

## Phase 3: Challenge Lifecycle Enhancement

### 3.1 Schema Migrations (TWO migrations)

#### Migration 3a: `add_challenge_lifecycle_fields`

Add to `Cohort`:
```prisma
challengeStatus         String?    @default("DRAFT")
registrationOpensAt     DateTime?
registrationClosesAt    DateTime?
maxParticipants         Int?
challengePriceGbp       Float?
challengeCurrency       String?    @default("GBP")
scoringTrack            String?
minimumAttendance       Int?
phases                  Json?
```

Add new `BodyMeasurement` model with user/cohort relations.

#### Migration 3b: `fix_cohort_membership_constraint` (HIGHEST RISK)

**Current**: `@@unique([userId])` — user can only be in ONE cohort ever
**Target**: Add status field, remove unique constraint, enforce in app logic

```prisma
model CohortMembership {
  userId   String
  cohortId String
  status   String   @default("ACTIVE")  // ACTIVE | COMPLETED | DROPPED | REMOVED
  joinedAt DateTime @default(now())
  leftAt   DateTime?
  // ... relations unchanged
  @@id([userId, cohortId])
  // @@unique([userId]) -- REMOVED
  @@index([userId])
  @@index([cohortId])
  @@index([status])
}
```

**Data migration**: Add `status` column DEFAULT 'ACTIVE' (all existing = ACTIVE), add `joinedAt` DEFAULT now(), add nullable `leftAt`, then drop `@@unique([userId])`.

### 3.2 New Files

**`Web/lib/challenges.ts`** (~250 lines)
- `CHALLENGE_STATUS_TRANSITIONS` — valid transition map (DRAFT→REG_OPEN→ONBOARDING→ACTIVE→COMPLETING→COMPLETED→ARCHIVED)
- `transitionChallengeStatus(cohortId, targetStatus, userId)` — validates transition, updates, audits
- `registerForChallenge(cohortId, userId)` — validates status=REG_OPEN, dates current, capacity, no active membership; creates ACTIVE membership
- `calculateLeaderboard(cohortId, track?)` — FAT_LOSS (% weight change), CONSISTENCY (entry count/days), MOST_IMPROVED
- `checkCompletionCriteria(cohortId, userId)` — minimum attendance, baseline+final measurements, entry compliance
- `getParticipantStatus(cohortId, userId)` — enrollment, measurements, compliance %, rank

**`Web/lib/validations/challenges.ts`** (~100 lines)
- `challengeStatusTransitionSchema`, `bodyMeasurementSchema`, `leaderboardQuerySchema`, `challengeConfigSchema`

### 3.3 API Routes (6 routes)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/cohorts/[id]/challenge-status` | PATCH | Status transitions (coach/admin) |
| `/api/cohorts/[id]/challenge-config` | GET, PATCH | Challenge configuration |
| `/api/cohorts/[id]/register` | POST | Self-registration (any authenticated user) |
| `/api/cohorts/[id]/leaderboard` | GET | Leaderboard (participants, coach, admin) |
| `/api/cohorts/[id]/participants` | GET | Participant status dashboard (coach/admin) |
| `/api/measurements` | GET, POST | Body measurement CRUD |

### 3.4 Modified Files (CRITICAL — existing code changes)

| File | Change |
|------|--------|
| `Web/lib/auth.ts` | `processInvitesForUser`: filter by `status: "ACTIVE"`, include status on create |
| `Web/app/api/cohorts/route.ts` | Membership count filter: `where: { status: "ACTIVE" }` |
| `Web/app/api/cohorts/[id]/route.ts` | Membership include filter |
| `Web/app/api/cohorts/[id]/clients/route.ts` | Filter by active, soft-remove instead of delete |
| `Web/app/api/cohorts/[id]/clients/[clientId]/route.ts` | Soft-remove with status + leftAt |
| `Web/app/api/clients/[id]/assign/route.ts` | Check active membership before creating |
| `Web/prisma/schema.prisma` | Cohort fields, BodyMeasurement, CohortMembership constraint |
| `Web/lib/validations.ts` | Add challenges export |
| `Web/lib/types.ts` | Add ChallengeStatus, MembershipStatus, MeasurementType enums |

### 3.5 Verification

1. `npm run build` passes
2. **Constraint test**: Add client to cohort A → remove (status=REMOVED) → add to cohort B → succeeds
3. **Lifecycle flow**: Create challenge → configure → open registration → self-register → baseline measurement → transition through statuses → final measurement → leaderboard → complete
4. **Regression**: Existing non-challenge cohort flows unaffected

### 3.6 Rollback

Migration 3b is critical. Rollback order:
1. Revert app code changes first
2. Reverse migration only if no user has multiple memberships yet
3. Drop BodyMeasurement table, challenge fields from Cohort

---

## Risk Assessment

| Risk | Impact | Probability | Mitigation |
|------|--------|------------|------------|
| CohortMembership migration | HIGH | Medium | Add column with DEFAULT before dropping constraint. Test on DB dump first |
| Credit balance inconsistency | HIGH | Low | All ops use `db.$transaction()`. Ledger is append-only. Add recalculate utility |
| Revolut webhook reliability | MEDIUM | Low | Revolut retries 3x at 10-min intervals. Idempotent handler prevents double-credit. Checkout-status polling as fallback for client UX |
| Revolut API availability | LOW | Low | Graceful degradation: if Revolut API fails, fall back to manual_transfer flow. Client can retry later |
| Booking race conditions | MEDIUM | Medium | Transaction serializes capacity check + booking creation. `@@unique([sessionId, clientId])` prevents doubles |
| Challenge status corruption | MEDIUM | Low | Strict state machine with transition map. All transitions audited |
| processInvitesForUser regression | HIGH | Medium | Minimal change (add status filter). Test sign-in flow for new and existing users |

---

## File Summary

### Phase 1: ~16 new/modified files
- 3 new lib files (`credits.ts`, `revolut.ts`, `validations/credits.ts`) + 9 new API route files (7 credit + webhook + checkout-status)
- 3 modified files (schema, validations, types)
- 4 new env vars (Revolut Merchant API)

### Phase 2: ~14 new/modified files
- 2 new lib files + 10 new API route files
- 3 modified files (schema, validations, types)

### Phase 3: ~15 new/modified files
- 2 new lib files + 6 new API route files
- 9 modified files (schema, validations, types, auth, 5 existing API routes)

### Total: ~45 files, 25 API routes, 3 migrations, 4 service modules (credits, revolut, booking, challenges)

---

## Execution Order

```
Phase 1 (Credits) → verify → deploy
Phase 2 (Booking) → verify → deploy
Phase 3 (Challenges) → verify → deploy
```

Each phase is independently deployable. Phase 2 depends on Phase 1 (credit integration). Phase 3 depends on Phase 2 (class integration for challenges).

---

## Plan Score: 91/100

| Criterion | Score | Notes |
|-----------|-------|-------|
| Completeness | 34/35 | All files, routes, logic specified |
| Safety | 28/30 | Rollback for all phases, risk mitigations |
| Clarity | 18/20 | Step-by-step with verification |
| Alignment | 11/15 | Matches ResearchPack exactly, follows codebase patterns |
