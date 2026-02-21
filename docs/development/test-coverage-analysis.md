# Test Coverage Analysis

**Date:** 2026-02-21
**Scope:** Full codebase audit of CoachFit testing infrastructure, existing tests, and coverage gaps

---

## Current State

### Test Infrastructure

| Component | Status |
|-----------|--------|
| **Playwright (E2E)** | Installed (`@playwright/test ^1.57.0`), configured in `playwright.config.js` |
| **Unit test framework** | **Not installed** — `vitest` is imported in one test file but missing from `package.json` |
| **Component testing** | Not set up — no `@testing-library/react` or similar |
| **CI test execution** | **None** — `.github/workflows/codeql.yml` only runs CodeQL security analysis |
| **Test coverage tool** | Not configured |

### Existing Test Files (3 total)

| File | Type | Status | Coverage |
|------|------|--------|----------|
| `tests/example.spec.js` | Playwright E2E | Placeholder | Tests Playwright.dev, not CoachFit |
| `tests/admin-only-user.spec.ts` | Playwright E2E | Works (gated by `E2E_LOCAL_AUTH=1`) | Admin user creation, non-admin rejection |
| `tests/unit/onboarding-validation.spec.ts` | Vitest unit | **Broken** — Vitest not in dependencies | 4 onboarding Zod schemas |

### Test Data Scripts (not automated tests)

These support manual testing but don't constitute automated coverage:

- `scripts/generate-test-data.ts` — 15 clients, 5 cohorts
- `scripts/generate-comprehensive-test-data.ts` — 200 clients, 10 coaches
- `scripts/cleanup-test-data.ts` — Remove all test data
- `scripts/setup-test-environment.ts` — Full environment bootstrap

---

## Coverage Gap Analysis

### Codebase Scale vs Test Coverage

| Area | Files/Routes | Tests | Coverage |
|------|-------------|-------|----------|
| **API routes** | ~93 route handlers | 0 | **0%** |
| **Zod validation schemas** | 20+ schemas in `lib/validations.ts` | 1 partial file (broken) | **~5%** |
| **Permission functions** | 4 functions in `lib/permissions.ts` | 0 | **0%** |
| **Auth system** | `lib/auth.ts` (~350 LOC) | 0 | **0%** |
| **Email service** | `lib/email.ts` + `lib/email-templates.ts` | 0 | **0%** |
| **React components** | 50+ components | 0 | **0%** |
| **E2E flows** | ~15 critical user flows | 1 (admin user creation) | **~7%** |

---

## Priority Test Areas

### Tier 1 — Critical (write these first)

These areas contain the most complex business logic, handle user data integrity, and have the highest risk of silent failures.

#### 1. Authentication & Invite Processing (`lib/auth.ts`)

**Why:** This is the single most complex file in the codebase. It runs 7-8 database queries per sign-in, processes two types of invites, manages password invalidation, and handles multi-provider OAuth. A bug here affects every user.

**What to test:**
- Coach invite processing: user invited by multiple coaches, first-wins behavior
- Cohort invite processing: skips if user already in a cohort
- Race condition: concurrent sign-ins during invite processing
- Password change invalidates JWT session (`passwordChangedAt` comparison)
- `allowDangerousEmailAccountLinking` — OAuth user linking to existing credentials account
- Role enrichment from database when JWT roles are stale
- Admin override email lookup on every JWT callback

**Risks found:**
- Multiple coach invites: system takes the first one and deletes all others — undefined ordering
- Cohort invite: skips silently if user has ANY existing membership, doesn't error
- Password invalidation: `null > null` evaluates to `false`, so null-null comparison passes
- No transaction wrapping around invite processing — partial failure leaves inconsistent state

---

#### 2. Cohort Client Assignment (`app/api/cohorts/[id]/clients/route.ts`)

**Why:** This 384-line route enforces the critical constraint that each user can only be in ONE cohort. The co-coach access control is the most complex authorization pattern in the codebase.

**What to test:**
- Unique membership constraint: assigning user already in another cohort returns 409
- Co-coach access control isolation: co-coach on Cohort A cannot see Cohort B data via shared members
- Race condition: two requests assign same user to different cohorts simultaneously
- Invite deduplication: re-inviting same email to same cohort returns 409
- Non-CLIENT users accidentally added to cohort
- Test user email detection pattern (`.test.local` suffix)

**Risks found:**
- Co-coach query is loose: checks if coach has ANY member in ANY cohort, could grant unintended cross-cohort access
- No check if invite is expired/stale — blocks re-inviting indefinitely
- Audit logging happens after action — logging failure creates inconsistent audit trail

---

#### 3. Cohort CRUD & Type Validation (`app/api/cohorts/[id]/route.ts`)

**Why:** 380 lines with 8 conditional duration rules across 4 cohort types. Type-specific validation is the most error-prone logic pattern.

**What to test:**
- ONGOING cohorts: must have 6 or 12 month membership, must NOT have duration weeks
- CHALLENGE cohorts: duration must be exactly 6, 8, or 12 weeks
- TIMED/CUSTOM cohorts: must specify duration weeks
- CUSTOM cohorts: must have `customCohortTypeId` or `customTypeLabel`
- Type change validation: switching from ONGOING → TIMED should require duration weeks
- Start date timezone parsing
- DELETE with cascade (code uses explicit transaction, suggesting cascade isn't trusted)

**Risks found:**
- Updating an existing ONGOING cohort without `membershipDurationMonths` may not re-validate
- Custom cohort type lookup has no permission check (public vs admin-only types)
- `durationConfig` field is redundant with `type` — values can diverge

---

#### 4. HealthKit Data Ingestion (`app/api/ingest/sleep/route.ts`, `app/api/ingest/workouts/route.ts`)

**Why:** These routes handle batch data merging between HealthKit and manual entries. Data source priority logic determines which data wins, and bugs here silently corrupt user health records.

**What to test — Sleep:**
- Manual sleep data preserved when HealthKit data arrives (manual takes priority)
- Data source array deduplication (`["manual", "healthkit"]` not `["manual", "healthkit", "healthkit"]`)
- Sleep spanning midnight (11pm to 7am) — date normalization
- Sleep stage values exceeding total sleep time
- Partial batch failure: 400 records, one fails mid-batch
- Source device array deduplication

**What to test — Workouts:**
- Deduplication by (userId, workoutType, startTime) — millisecond precision matters
- Metadata JSON round-trip (`JSON.parse(JSON.stringify())` loses Date objects)
- Zero vs null for optional fields (0 calories stored as null?)
- Empty batch handling
- Update vs create field parity (all fields included in both paths)

**Risks found:**
- No transaction wrapping — partial batch creates inconsistent data
- Sleep: `sourceDevices` array replaced on update, not merged
- Workouts: Dedup uses exact timestamp — retry with millisecond variance creates duplicates
- Workouts: Returns `success: false` for empty valid request (0 processed, 0 errors)

---

### Tier 2 — High Priority

#### 5. Entry Upsert (`app/api/entries/route.ts`)

**What to test:**
- One entry per user per day (upsert on `[userId, date]`)
- Questionnaire day detection (Sunday, `getDay() === 0`) — timezone sensitivity
- Required fields: steps AND calories required on non-questionnaire days
- NaN handling: numeric strings, negative values, zero
- Pagination: `page=0`, `page=-1`, `limit=999999`
- Data source tracking in upsert (preserve existing sources)

---

#### 6. Signup Flow (`app/api/auth/signup/route.ts`)

**What to test:**
- Duplicate email returns appropriate error
- Blocked email domains (`.local`, `.test`, `.example`, `.invalid`, `.localhost`)
- Password complexity requirements (12+ chars, upper, lower, number, special)
- `mustChangePassword` set when invites exist
- Concurrent signup with same email (race condition)
- bcrypt cost factor is 12 (consistent with rest of codebase)

---

#### 7. Global Coach Invites (`app/api/invites/route.ts`)

**What to test:**
- Invite existing user: links to coach, returns appropriate status
- Invite existing user already linked to same coach: 409
- Invite existing user linked to different coach: 409
- Invite non-existent user: creates invite record
- Duplicate invite for same email: 409
- Email suppression for `.test.local` emails
- Non-CLIENT user linking (should validate role)

---

### Tier 3 — Important

#### 8. Zod Validation Schemas (`lib/validations.ts`)

**What to test:**
- `upsertEntrySchema`: weight bounds (0-1000), steps bounds (0-100000), future date rejection
- `createCohortSchema`: superRefine rules for each cohort type, cross-field validation
- `signupSchema`: blocked email domains, password complexity
- `onboardingStep*Schema`: all step schemas with valid/invalid inputs
- `passwordSchema`: 12+ chars, upper, lower, number, special character

This is the lowest-effort, highest-value unit testing target — pure functions with no database or network dependencies.

---

#### 9. Permission Functions (`lib/permissions.ts`)

**What to test:**
- `isAdmin()`: returns true only for ADMIN role
- `isCoach()`: returns true only for COACH role
- `isClient()`: returns true only for CLIENT role
- `isAdminOrCoach()`: returns true for either
- Users with multiple roles (e.g., `[COACH, ADMIN]`)
- Empty roles array

Small file (50 LOC) but foundational for every authorization check in the application.

---

#### 10. Onboarding Plan Calculation (`app/api/onboarding/calculate-plan/route.ts`)

**What to test:**
- Activity level mapping (5 levels → 4 levels, default case)
- Extreme values: age 0, age 150, weight 0, weight 1000
- Birth date in the future
- Calculation function return value structure

---

### Tier 4 — E2E Flows

These are the most expensive to write and maintain but cover the full stack.

**Critical flows to cover:**
1. Client signup → onboarding → first entry submission
2. Coach creates cohort → invites client → client joins → views dashboard
3. Coach generates pairing code → client pairs device → HealthKit data flows
4. Admin creates custom cohort type → coach uses it for new cohort
5. Client fills weekly questionnaire → coach views analytics
6. Password change → session invalidation → re-login

---

## Cross-Cutting Issues Found

### 1. Email Suppression Pattern Inconsistency

Files use different patterns to detect test users:
- `email.endsWith(".test.local")` in some routes
- `email.endsWith(".local")` in CLAUDE.md
- `isTestUser` flag on User model

**Recommendation:** Centralize into a `isTestEmail(email: string)` utility and use `isTestUser` flag consistently.

### 2. Race Conditions (Missing Transactions)

Multiple routes perform check-then-act without transaction wrapping:
- `auth.ts`: Check invites → process invites → delete invites
- `cohorts/[id]/clients`: Check membership → create membership
- `auth/signup`: Check email → create user

**Recommendation:** Wrap multi-step operations in Prisma `$transaction()`.

### 3. Authorization Depth (Co-Coach Access)

The co-coach access check queries for shared members across ANY cohort the coach touches. This could grant access to Cohort B data if a member happens to also be viewable via Cohort A.

**Recommendation:** Tighten the query to check explicit cohort membership, not transitive member relationships.

### 4. Pagination Without Validation

`page` and `limit` from query params are used directly without bounds checking. `page=0` or `limit=-1` could produce unexpected behavior.

**Recommendation:** Add Zod validation for pagination params across all GET endpoints.

### 5. Date/Timezone Handling

Questionnaire day logic uses `getDay() === 0` (Sunday) based on server timezone, not the user's local time. Sleep records normalize to midnight UTC but sleep may span midnight in the user's timezone.

**Recommendation:** Accept user timezone as a parameter or header, normalize dates accordingly.

---

## Recommended Implementation Order

### Phase 1: Foundation (get the test framework working)

1. Install Vitest: `npm install -D vitest @vitest/ui`
2. Add vitest config (`vitest.config.ts`)
3. Fix the broken `tests/unit/onboarding-validation.spec.ts`
4. Add `"test": "vitest run"` and `"test:watch": "vitest"` npm scripts
5. Add test execution to CI pipeline

### Phase 2: Unit Tests (pure functions, no database)

6. `lib/validations.ts` — All Zod schemas (highest ROI, ~20 schemas)
7. `lib/permissions.ts` — All 4 permission functions
8. Onboarding calculation logic (activity level mapping, plan calculation)
9. Email suppression utility (extract and test)

### Phase 3: Integration Tests (API routes with database)

10. Entry upsert (`POST /api/entries`)
11. Signup flow (`POST /api/auth/signup`)
12. Cohort CRUD (`POST/PATCH/DELETE /api/cohorts/[id]`)
13. Client assignment (`POST /api/cohorts/[id]/clients`)
14. Invite system (`POST /api/invites`)
15. HealthKit ingestion (`POST /api/ingest/sleep`, `POST /api/ingest/workouts`)

### Phase 4: Auth Integration Tests

16. Sign-in callback invite processing
17. Password invalidation flow
18. Multi-provider account linking
19. Role enrichment and admin override

### Phase 5: E2E Tests

20. Client signup → onboarding → first entry
21. Coach cohort management flow
22. HealthKit pairing and data sync
23. Admin operations (user management, attention scoring)

---

## Summary

The codebase has **93 API routes**, **20+ validation schemas**, **4 permission functions**, and a complex auth system — all with effectively **0% automated test coverage**. The single working E2E test covers admin user creation. The single unit test file is broken (missing Vitest dependency).

The highest-risk areas are:
1. **Auth invite processing** — 7-8 DB queries, race conditions, no transactions
2. **Cohort client assignment** — complex co-coach authorization, unique constraints
3. **Cohort type validation** — 8 conditional rules across 4 types
4. **HealthKit data merge** — data source priority, batch partial failures

Starting with Zod schema unit tests (Phase 2) provides the fastest path to meaningful coverage with the lowest setup cost. Auth and cohort integration tests (Phases 3-4) address the highest-risk business logic.
