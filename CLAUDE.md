# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CoachSync is a fitness tracking platform connecting coaches and clients. Built with Next.js 16 (App Router), TypeScript, Prisma ORM, PostgreSQL, and NextAuth.js v5. The app enables coaches to manage cohorts, invite clients, and track client fitness data (weight, steps, calories, sleep quality, perceived effort, and custom prompts).

---

## 🚨 NON-NEGOTIABLE RULE

**ALL development is executed as parallel, full-stack batches.**

If a change touches a feature, it touches:
- Product intent
- Frontend
- Backend
- Data
- Tests
- Docs
- Deployment implications

**Sequential thinking is forbidden.**

---

## 🧠 OPERATING PHILOSOPHY

You are a solo developer, but you think like a team.
- **Parallel thinking, not parallel humans**
- **One response = one coherent system slice**
- **Batch delivery > incremental drip**
- **MVP first, refinement later**
- **Shippable always beats elegant**

This contract optimizes for:
- Limited time
- Limited energy
- Maximum leverage
- Minimal rework

**Momentum > perfection.**

---

## 🧩 ROLE COLLAPSE (MENTAL LANES)

Every task implicitly executes these lanes together:

| Lane | Responsibility |
|------|----------------|
| **Product Owner** | Scope, priorities, trade-offs |
| **Architect** | System shape, seams, constraints |
| **Frontend Dev** | UI, state, UX |
| **Backend Dev** | APIs, logic, auth |
| **Data** | Schema, migrations, integrity |
| **QA** | Break it before users do |
| **DevOps** | Build, deploy, observe |

**No lane runs alone.**

---

## ⚡ FULL-STACK PARALLEL EXECUTION RULES

### ❌ Forbidden
- "Let's just do backend first"
- "We'll add tests later"
- "Docs after MVP"
- "Frontend stub only"
- "We'll think about deployment later"

### ✅ Required
- Frontend + backend + data designed together
- Tests written alongside implementation
- Deployment implications considered immediately
- Docs updated in the same batch

---

## 🧱 STANDARD BATCH SHAPE (DEFAULT)

Every meaningful feature ships as one batch:

```
[Batch – Feature Slice]

• Product decision notes
• Frontend components
• Backend routes/controllers
• Data models / migrations
• Tests (unit + integration, minimum)
• Config / env changes
• Documentation updates
```

**If any part is missing → the batch is incomplete.**

---

## Common Commands

### Development
```bash
npm run dev              # Start development server (Turbopack)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

### Database Operations
```bash
npm run db:generate      # Generate Prisma Client (run after schema changes)
npm run db:push          # Push schema changes to database (for prototyping)
npm run db:migrate       # Run database migrations (for production)
npm run db:studio        # Open Prisma Studio (database GUI)
npm run db:seed          # Seed test users (coach@test.local, client@test.local, etc.)
```

### Test Data Generation
```bash
npm run test:cleanup                  # Remove all test data
npm run test:generate                 # Generate basic test data (15 clients, 5 cohorts)
npm run test:generate-comprehensive   # Generate comprehensive test data (200 clients, 10 coaches)
```

### Admin Utilities
```bash
npm run admin:set        # Set admin role for a user: npm run admin:set <email>
npm run password:set     # Set password for a user: npm run password:set <email> <password>
```

### Email Setup (Resend)
```bash
npm run email:setup-templates  # Setup email templates in Resend
npm run email:verify           # Verify Resend API key
npm run email:setup-audience   # Setup broadcast audience
```

## Architecture & Key Concepts

### Authentication & Authorization

**NextAuth.js v5 (lib/auth.ts)**
- JWT session strategy with 1-hour duration (configurable in `authOptions.session.maxAge`)
- Multiple providers: Google OAuth (required), Apple Sign-In (optional), Email/Password (Credentials)
- User roles stored in JWT token and database: CLIENT, COACH, ADMIN
- Users can have multiple roles (e.g., COACH + ADMIN)

**Middleware (middleware.ts)**
- Lightweight JWT parsing to avoid Edge Function size limits (no NextAuth imports)
- Parses JWT token manually to extract roles
- Role-based route protection for API and pages
- Public routes bypass authentication

**Permissions (lib/permissions.ts)**
- `isAdmin()`: Full admin access (can see all cohorts, assign coaches, manage users)
- `isCoach()`: Create cohorts, invite clients, view client data
- `isClient()`: Submit entries, view own dashboard
- `isAdminOrCoach()`: Helper for routes allowing both admin and coach access

**Important**: ADMIN does NOT replace COACH role. Users must have COACH role to act as coach. Admin is purely for system-level operations.

### Data Model & Relationships

**Core Models (prisma/schema.prisma)**

1. **User**: Central entity with roles array, can be CLIENT, COACH, or ADMIN
   - `invitedByCoachId`: Tracks which coach invited the user (global invite)
   - `isTestUser`: Suppresses emails for test accounts
   - `passwordHash`: Optional (OAuth users don't have password)
   - `onboardingComplete`: Tracks onboarding flow completion

2. **Cohort**: Group of clients managed by a coach
   - `coachId`: Owner of the cohort
   - Has many CohortMemberships (clients)
   - Has optional CohortCheckInConfig (custom prompts)

3. **CohortMembership**: Join table linking User (CLIENT) to Cohort
   - Composite key: `[userId, cohortId]`
   - Cascade deletes when user or cohort is deleted

4. **Entry**: Daily fitness data submitted by clients
   - Core fields: `weightLbs`, `steps`, `calories` (all optional)
   - Phase 2 fields: `sleepQuality` (1-10), `perceivedEffort` (1-10), `notes` (text)
   - Phase 3: `customResponses` (JSON) for coach-defined prompts
   - Unique constraint: `[userId, date]` (one entry per user per day)

5. **CoachInvite**: Global coach invitation (links user to coach, not specific cohort)
   - Email + coachId unique constraint
   - Auto-processed on sign-in (sets `invitedByCoachId` on User)
   - Deleted after processing

6. **CohortInvite**: Cohort-specific invitation
   - Email + cohortId unique constraint
   - Auto-processed on sign-in (creates CohortMembership)
   - Deleted after processing

7. **CohortCheckInConfig**: Custom prompts per cohort
   - `enabledPrompts`: Array of prompt keys to show clients
   - `customPrompt1`, `customPrompt1Type`: Coach-defined custom questions

8. **CoachNote**: Weekly coach notes for clients
   - `weekStart`: Monday of the week (for grouping)
   - `noteDate`: Date when note was recorded
   - Unique constraint: `[coachId, clientId, weekStart]`

9. **AdminInsight**: Auto-generated insights for admin dashboard
   - `entityType`: "user" | "coach" | "cohort" | "system"
   - `insightType`: "trend" | "anomaly" | "opportunity" | "alert"
   - `priority`: "red" | "amber" | "green"

10. **AttentionScore**: Calculated attention scores for prioritization
    - Unique per entity (user/coach/cohort)
    - 0-100 score with reasons array

11. **AdminAction**: Audit trail for admin operations
    - Tracks all admin actions with target type and details
    - Optional reference to insight that triggered action

### Invitation Flow

**Two-tier invitation system:**

1. **Global Coach Invite (CoachInvite)**:
   - Coach invites client by email (no specific cohort)
   - On sign-in, user's `invitedByCoachId` is set to the coach
   - Client appears in coach's "unassigned clients" list
   - Coach can then assign to specific cohorts

2. **Cohort Invite (CohortInvite)**:
   - Coach invites client to a specific cohort
   - On sign-in, CohortMembership is automatically created
   - Client is immediately part of the cohort

**Processing (lib/auth.ts callbacks.signIn)**:
- Both invite types are processed automatically on user sign-in
- Invites are deleted after processing
- Multiple cohort invites can be processed simultaneously
- Only one coach invite is processed (first one)

### Email Service (lib/email.ts)

**Resend Integration**:
- Lazy initialization (only loads when API key is present)
- Test user suppression: Emails for `isTestUser: true` are logged, not sent
- Graceful degradation: Missing API key doesn't block user flows
- Default sender: `CoachSync <onboarding@resend.dev>` (should be updated to custom domain)

**Email Types**:
- Welcome emails (sent on user creation)
- Cohort invitations (sent when coach invites client)
- Global coach invitations (sent when coach invites client globally)

### API Route Patterns

**Standard Response Structure**:
```typescript
// Success
return NextResponse.json({ data: result })

// Error
return NextResponse.json({ error: "Error message" }, { status: 400 })
```

**Authentication Pattern (all protected routes)**:
```typescript
const session = await auth()
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
```

**Authorization Pattern (role-based routes)**:
```typescript
import { isCoach, isAdmin } from "@/lib/permissions"

if (!isCoach(session.user)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

**Ownership Validation (for coaches accessing cohorts)**:
```typescript
const cohort = await db.cohort.findUnique({
  where: { id: params.id }
})

if (!cohort) {
  return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
}

// Only owner or admin can access
if (cohort.coachId !== session.user.id && !isAdmin(session.user)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

**Validation Pattern**:
```typescript
import { createEntrySchema } from "@/lib/validations"

const body = await request.json()
const parsed = createEntrySchema.safeParse(body)

if (!parsed.success) {
  return NextResponse.json(
    { error: "Validation failed", details: parsed.error.errors },
    { status: 400 }
  )
}
```

### Frontend Architecture

**App Router Structure** (app/):
```
app/
├── client-dashboard/       # Client views (entry logging, history)
├── coach-dashboard/        # Coach views (cohort management, analytics)
├── admin/                  # Admin views (user management, system overview)
├── cohorts/[id]/          # Cohort details and analytics
├── clients/[id]/          # Individual client views (coach perspective)
├── api/                   # API routes organized by resource
│   ├── admin/            # Admin API endpoints
│   ├── auth/             # Authentication routes
│   ├── client/           # Client-specific APIs
│   ├── clients/          # Client management APIs (coach perspective)
│   ├── coach-dashboard/  # Coach dashboard APIs
│   ├── cohorts/          # Cohort management APIs
│   ├── entries/          # Entry logging APIs
│   └── invites/          # Invitation APIs
├── login/                 # Login page
├── signup/                # Signup page
├── dashboard/             # Root dashboard redirect
└── onboarding/            # Onboarding flow
```

**Backend Structure**:
```
lib/
├── auth.ts               # NextAuth configuration
├── db.ts                 # Prisma client instance
├── email.ts              # Email service (Resend)
├── permissions.ts        # Role-based permissions
├── types.ts              # TypeScript types
├── utils.ts              # Helper functions
└── validations.ts        # Zod validation schemas

prisma/
├── schema.prisma         # Prisma schema definition
├── migrations/           # Database migrations
└── seed.ts               # Seed script for test users

scripts/
├── generate-test-data.ts
├── set-admin.ts
├── set-password.ts
└── setup-email-templates.ts
```

**Server vs Client Components**:
- Default to Server Components for data fetching
- Use Client Components (`"use client"`) for:
  - Forms with state and event handlers
  - Interactive charts (Recharts)
  - Components using browser APIs
  - SessionProvider wrapper (components/SessionProvider.tsx)

**Dashboard Routing Logic** (app/dashboard/page.tsx):
- Redirects based on user role:
  - ADMIN → `/admin`
  - COACH → `/coach-dashboard`
  - CLIENT → `/client-dashboard`

**Related files are always created together:**
- Adding a feature = frontend component + API route + data model + tests
- Never create frontend without backend
- Never create API without validation schema
- Never create model without migration

### Important Behaviors

**Test User Email Suppression**:
- Users with `isTestUser: true` don't receive emails
- Emails are logged to console instead
- All seed script users are test users by default

**Password Authentication**:
- Seed script users don't have passwords set
- Use `npm run password:set <email> <password>` to enable email/password login
- OAuth users can have passwordHash, allowing both login methods

**Session Duration**:
- JWT sessions expire after 1 hour (configurable in lib/auth.ts)
- Can be adjusted for development: `maxAge: 30 * 24 * 60 * 60` (30 days)

**Entry Upsert Behavior** (POST /api/entries):
- Creates new entry or updates existing entry for the same date
- Uses Prisma `upsert` with unique constraint `[userId, date]`
- At least one field must be provided (validated in Zod schema)

**Cohort Membership Assignment**:
- Clients can be in multiple cohorts simultaneously
- Assigning client to cohort creates CohortMembership (doesn't affect other memberships)
- Removing from cohort deletes CohortMembership

**Admin Permissions**:
- Admins can view ALL cohorts (regardless of coachId)
- Admins can assign coaches to cohorts they don't own
- Admins can change user roles and reset passwords
- Admins do NOT automatically have COACH or CLIENT privileges

### Common Patterns

**Fetching User's Cohorts (Client)**:
```typescript
const memberships = await db.cohortMembership.findMany({
  where: { userId: session.user.id },
  include: { Cohort: { include: { User: true } } }
})
```

**Fetching Coach's Cohorts**:
```typescript
const cohorts = await db.cohort.findMany({
  where: { coachId: session.user.id },
  include: {
    memberships: { include: { user: true } },
    invites: true
  }
})
```

**Fetching Client Entries with Date Range**:
```typescript
const entries = await db.entry.findMany({
  where: {
    userId: clientId,
    date: {
      gte: startDate,
      lte: endDate
    }
  },
  orderBy: { date: 'desc' }
})
```

**Creating Entry (Upsert)**:
```typescript
const entry = await db.entry.upsert({
  where: {
    userId_date: {
      userId: session.user.id,
      date: new Date(parsedDate)
    }
  },
  update: { weightLbs, steps, calories },
  create: { userId: session.user.id, date: new Date(parsedDate), weightLbs, steps, calories }
})
```

### Database Schema Changes

**Schema changes are part of the feature batch, not an afterthought.**

When modifying the database schema:

1. Update `prisma/schema.prisma`
2. Run `npm run db:migrate` to create a migration
3. Run `npm run db:generate` to update Prisma Client types
4. Update TypeScript types if needed (lib/types.ts)
5. Update Zod validation schemas if needed (lib/validations.ts)
6. Update affected API routes and frontend components
7. Write tests for the new schema behavior

**Important**: Always run migrations in order. Don't skip migrations or modify existing migrations.

**Batch requirement**: Schema change + migration + types + validation + API + frontend + tests = one complete batch.

---

## 🧪 TESTING CONTRACT

**Testing runs in parallel with development, not after.**

### Minimum per feature:
- Frontend component or hook test (if applicable)
- Backend route or service test
- Database integrity verification

### Preferred:
- Integration test per critical path
- E2E only when value > effort

### CoachSync Test Setup:
```bash
# Unit tests for utilities and services
# Integration tests for API routes
# E2E tests for critical flows (login, entry submission, cohort creation)

npm run test              # Run all tests (when implemented)
npm run test:watch        # Watch mode for TDD (when implemented)
```

### Test Data for Development:
```bash
npm run db:seed           # Basic test users
npm run test:generate     # Full test dataset with entries
```

**Untested critical paths = unfinished work.**

**Location patterns:**
```
app/api/[resource]/route.test.ts     # API route tests
lib/[module].test.ts                 # Utility/service tests
components/[component].test.tsx      # Component tests
```

---

## 🔒 SECURITY BASELINE (ALWAYS ON)

Even for personal projects, every feature includes:

### Input Validation:
- All API inputs validated with Zod schemas (lib/validations.ts)
- Type-safe database queries with Prisma
- SQL injection protection (via Prisma)
- XSS protection (via React automatic escaping)

### Authentication & Authorization:
- Session validation on all protected routes
- Role-based access control (lib/permissions.ts)
- JWT token with 1-hour expiration
- Password hashing with bcrypt (10 rounds)

### Secrets Management:
- Never hard-code secrets
- Use environment variables (.env.local)
- Vercel environment variables for production
- API keys validated before use

### Rate Limiting (where relevant):
- Email sending (via Resend)
- API endpoints (implement as needed)
- Login attempts (implement as needed)

### Data Protection:
- Test user email suppression (isTestUser flag)
- Cascade deletes properly configured in Prisma schema
- Unique constraints on sensitive relationships

**Security debt compounds faster than code debt.**

**Security checklist for every API route:**
- [ ] Authentication check (`await auth()`)
- [ ] Authorization check (role/ownership validation)
- [ ] Input validation (Zod schema)
- [ ] Error messages don't leak sensitive info
- [ ] Database queries use parameterized queries (Prisma handles this)

---

## ⏱️ TIME-AWARE EXECUTION (SOLO REALITY)

Assumptions baked in:
- Evenings / weekends work
- Fragmented focus time
- Limited energy reserves

Therefore:
- **Prefer small vertical slices** (one feature end-to-end)
- **Avoid speculative abstraction** (solve the problem at hand)
- **Bias to visible progress** (working UI > perfect architecture)
- **Stop early if ROI drops** (MVP first, refinement later)

### Time Management Patterns:

**1-Hour Sessions** (evening work):
- Pick one small feature slice
- Implement frontend + backend + tests
- Commit and deploy

**4-Hour Sessions** (weekend morning):
- Pick one medium feature
- Full batch implementation
- Write docs, test thoroughly
- Deploy and monitor

**When stuck:**
- Reduce scope, not quality
- Ship the 80% solution
- Document the 20% for later
- Move forward

**Momentum > perfection.**

---

## 🎯 MVP DELIVERY RHYTHM (GUIDE)

### Week 1: Core value + data
- Essential database models
- Basic auth flow
- Minimum viable API routes
- Seed data for testing

### Week 2: Usable UI + flows
- Core user journeys (login, main action)
- Basic styling (Tailwind utilities)
- Client-side validation
- Error handling

### Week 3: Tests, bugs, performance
- Write missing tests
- Fix obvious bugs
- Add loading states
- Basic error boundaries

### Week 4: Deploy, observe, document
- Production deployment
- Monitor for errors
- Update documentation
- Plan next iteration

**Adjust as needed — never abandon batching.**

---

### Environment Variables

**Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_URL` - App URL (http://localhost:3000 for local)
- `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `RESEND_API_KEY` - Resend API key for emails

**Optional**:
- `APPLE_CLIENT_ID` - Apple Sign-In client ID
- `APPLE_CLIENT_SECRET` - Apple Sign-In client secret
- `NEXT_PUBLIC_APPLE_CLIENT_ID` - Public Apple client ID (for client-side rendering)

**Note**: `.env.local` is git-ignored and NOT deployed. For production (Vercel), configure environment variables in the dashboard.

### Testing Locally

1. **Setup Test Users**:
   ```bash
   npm run db:seed  # Creates coach@test.local, client@test.local, etc.
   npm run password:set coach@test.local coach123
   npm run password:set client@test.local client123
   ```

2. **Generate Test Data**:
   ```bash
   npm run test:generate  # Creates 5 cohorts, 15 clients, entries
   ```

3. **Login and Test**:
   - Coach: `coach@test.local` / `coach123`
   - Client: `client@test.local` / `client123`

4. **Cleanup**:
   ```bash
   npm run test:cleanup  # Removes all test data
   ```

## 🔀 GITHUB WORKFLOW

**Claude has authority to create issues, pull requests, and merge PRs for batch deliveries.**

### Work Size Decision Tree:

**Small/Medium Work** (Direct PR):
- Clear requirements
- Single feature slice
- <4 hour implementation
- Limited architectural decisions
- **Flow**: Branch → Implement → PR → Notify → Merge

**Large/Complex Work** (Issue First):
- Needs brainstorming/planning
- Multiple feature slices
- >4 hour implementation
- Significant architectural decisions
- Multiple valid approaches to consider
- **Flow**: Issue with implementation guide → Discussion → Branch → Implement → PR → Merge

---

### Large Work: Issue-First Flow

For big, brainstorming-focused work:

1. **Create GitHub Issue** with implementation guide
2. **User Reviews & Discusses** the approach
3. **Refine Plan** based on feedback
4. **Create Branch** and implement
5. **Create PR** referencing the issue
6. **Merge** after verification

### Issue Template (for large work):
```markdown
## Problem Statement
[What are we solving and why?]

## Proposed Approach
[High-level architectural approach]

## Implementation Guide

### Data Layer
- [ ] Schema changes needed
- [ ] Migration strategy
- [ ] Data integrity considerations

### Backend
- [ ] API endpoints to create/modify
- [ ] Authentication/authorization requirements
- [ ] Business logic changes

### Frontend
- [ ] Components to create/modify
- [ ] State management approach
- [ ] User flows affected

### Testing Strategy
- [ ] Unit tests needed
- [ ] Integration tests needed
- [ ] E2E scenarios

### Security Considerations
- [ ] Auth/authz implications
- [ ] Input validation requirements
- [ ] Data protection concerns

### Deployment Plan
- [ ] Environment variables needed
- [ ] Database migration steps
- [ ] Rollback strategy
- [ ] Monitoring requirements

## Alternative Approaches Considered
[What else could we do and why this approach is preferred]

## Open Questions
[What needs discussion/decision]

## Estimated Complexity
[Small/Medium/Large, time estimate if known]
```

---

### Small/Medium Work: Direct PR Flow

For straightforward feature slices:

1. **Branch Creation**: Create feature branch from main
2. **Batch Implementation**: Implement full feature slice (frontend + backend + data + tests + docs)
3. **PR Creation**: Create pull request with complete batch
4. **User Notification**: Notify user of PR with summary
5. **Merge**: Merge PR after user acknowledgment (or immediately if urgent)

### PR Naming Convention:
```
Feature: [User-facing feature name]
Batch: [Technical scope description]
```

Examples:
- `Feature: Client Password Reset | Batch: Settings page + API + validation`
- `Feature: Coach Weekly Notes | Batch: UI + API + schema migration`
- `Fix: Entry submission validation | Batch: Frontend validation + error handling`

### PR Description Template:
```markdown
## Batch Summary
[One-line description of what ships]

## Changes
- Frontend: [what was built]
- Backend: [what was built]
- Data: [schema changes, if any]
- Tests: [what was tested]
- Security: [auth/validation added]

## Deployment Notes
- [ ] Environment variables needed: [yes/no]
- [ ] Database migration required: [yes/no]
- [ ] Breaking changes: [yes/no]

## Testing Done
- [ ] Tested with seed data
- [ ] Build passes locally
- [ ] Verified all user roles (CLIENT/COACH/ADMIN as applicable)

## Rollback Plan
[How to undo this if needed]
```

### Branch Naming:
```
feature/[feature-name]
fix/[bug-description]
refactor/[area-being-refactored]
```

Examples:
- `feature/client-password-reset`
- `fix/entry-validation-error`
- `refactor/auth-middleware`

---

## 🚀 DEPLOYMENT & RELEASE

**Deployment is part of development, not a phase.**

Each batch must answer:
- How this deploys
- What breaks if it fails
- How to roll back
- What to monitor

### CoachSync Deployment (Vercel + Railway)

**Vercel Setup**:
1. Environment variables must be configured in Vercel Dashboard (not from .env.local)
2. Update Google OAuth redirect URI: `https://your-domain.vercel.app/api/auth/callback/google`
3. Automatic deployments on push to main
4. Preview deployments for PRs

**Database (Railway PostgreSQL)**:
- Database migrations must be run manually or via Railway CLI
- Always test migrations on staging/preview before production
- Keep migration scripts in version control
- Plan rollback strategy for schema changes

**Deployment Checklist** (per batch/PR):
- [ ] Environment variables updated (if needed)
- [ ] Database migration tested
- [ ] OAuth redirect URIs updated (if needed)
- [ ] Build passes locally (`npm run build`)
- [ ] Tests pass (when implemented)
- [ ] Feature branch created from main
- [ ] PR created with complete batch description
- [ ] User notified of PR
- [ ] PR merged to main
- [ ] Vercel auto-deploys from main
- [ ] Monitor for errors in Vercel logs
- [ ] Test critical paths in production

**Edge Function Limitations**:
- Middleware is kept lightweight (manual JWT parsing) to stay under 1MB limit
- NextAuth imports in middleware cause bundle size issues - avoid them

**Solo-friendly defaults:**
- Boring infrastructure (Vercel, Railway)
- Free tiers where possible
- Scripted deploys (automatic via Vercel)
- Basic monitoring (Vercel logs)

**Rollback strategy:**
- Vercel: Instant rollback to previous deployment via dashboard
- Database: Keep reversible migration scripts
- Feature flags: Use environment variables for new features (can disable instantly)

---

## 📚 CONTINUOUS LEARNING (INTEGRATED, NOT SEPARATE)

Learning is captured inside the work, not as a side quest.

### For CoachSync:
Each feature may log (in comments or this doc):
- **Decisions made**: Why this approach over alternatives
- **Patterns learned**: Reusable patterns that worked well
- **Mistakes to avoid**: What didn't work and why

### Example Decision Log:
```typescript
// lib/auth.ts
// Decision: Manual JWT parsing in middleware.ts to avoid Edge Function size limits
// Pattern: NextAuth callbacks.signIn processes invites automatically on login
// Mistake avoided: Don't import NextAuth in middleware - causes bundle bloat
```

**No essays. Just future leverage.**

**Key learnings for this project:**
- Lightweight middleware = manual JWT parsing
- Invitation flow = auto-process on sign-in via callbacks
- Test users = suppress emails with isTestUser flag
- Role collapse = ADMIN doesn't replace COACH, users can have multiple roles
- Entry upsert = one entry per user per day via unique constraint

---

## 🧠 FINAL RULE (THE ONE THAT MATTERS)

**If it isn't thought through end-to-end, it isn't done.**

**If it can't ship, it doesn't count.**

### What "done" means for CoachSync:
- ✅ Feature works for all relevant user roles (CLIENT, COACH, ADMIN)
- ✅ Database schema updated with migration
- ✅ API route with authentication + authorization + validation
- ✅ Frontend component with proper state management
- ✅ Tests written (minimum: API route test)
- ✅ Documentation updated in CLAUDE.md (if architectural change)
- ✅ Deployed and tested in production

### Batch completion checklist:
```
[Batch – Example Feature: Client Password Reset]

✅ Product decision: Clients can reset their own password
✅ Frontend: Settings page with password reset form
✅ Backend: POST /api/client/change-password with auth check
✅ Data: No schema change needed (uses existing passwordHash)
✅ Validation: Zod schema for old/new password
✅ Tests: API route test for password change flow
✅ Security: Verify old password, hash new password, require auth
✅ Deployment: No env changes, works with existing auth setup
✅ Docs: Updated CLAUDE.md with new API route pattern
```

**This is the default operating mode.**

---

## 🎯 QUICK REFERENCE

### Starting a new feature:

**For Small/Medium Features (Direct PR)**:
1. Define the batch scope (what's the minimum shippable slice?)
2. Create feature branch: `git checkout -b feature/[name]`
3. Design data model changes (if needed)
4. Implement in parallel:
   - Update Prisma schema + create migration
   - Create API route with auth/validation
   - Build frontend component
   - Write tests alongside
5. Test locally with seed data
6. Create PR with complete batch description
7. Notify user and merge (or merge immediately if appropriate)
8. Verify deployment
9. Update docs (in PR or follow-up)

**For Large/Complex Features (Issue First)**:
1. Create GitHub issue with implementation guide
2. Present architectural approach and alternatives
3. Discuss and refine with user
4. Once approved, follow steps 2-9 above
5. Reference issue number in PR description

### Daily workflow:
```bash
npm run dev                    # Start dev server
npm run db:studio              # View database
npm run test:generate          # Generate test data
npm run password:set [email] [password]  # Set test user password

# For large/complex work: Create issue first
gh issue create --title "Feature: [name]" --body "[implementation guide]"
# Wait for user feedback, then proceed with implementation

# Make changes (frontend + backend + data + tests in one batch)

npm run build                  # Verify build works

# PR-based workflow (preferred for features)
git checkout -b feature/[feature-name]
git add .
git commit -m "Feature: [batch description]"
git push -u origin feature/[feature-name]
gh pr create --title "Feature: [name]" --body "[PR description]"
# After user acknowledgment or immediately:
gh pr merge --squash

# OR direct push (for tiny fixes only)
git add . && git commit -m "Fix: [description]"
git push                       # Auto-deploy via Vercel
```

### When stuck:
1. Reduce scope (smaller vertical slice)
2. Check existing patterns (this doc + codebase examples)
3. Test with seed data (npm run test:generate)
4. Ship the 80% solution
5. Move forward

**Momentum > perfection.**

---
