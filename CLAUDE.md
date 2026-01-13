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
- `app/client-dashboard/` - Client views (entry logging, history)
- `app/coach-dashboard/` - Coach views (cohort management, analytics)
- `app/admin/` - Admin views (user management, system overview)
- `app/cohorts/[id]/` - Cohort details and analytics
- `app/clients/[id]/` - Individual client views (coach perspective)
- `app/api/` - API routes organized by resource

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

When modifying the database schema:

1. Update `prisma/schema.prisma`
2. Run `npm run db:migrate` to create a migration
3. Run `npm run db:generate` to update Prisma Client types
4. Update TypeScript types if needed (lib/types.ts)
5. Update Zod validation schemas if needed (lib/validations.ts)

**Important**: Always run migrations in order. Don't skip migrations or modify existing migrations.

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

### Deployment Notes

**Vercel Deployment**:
- Environment variables must be configured in Vercel Dashboard (not from .env.local)
- Update Google OAuth redirect URI: `https://your-domain.vercel.app/api/auth/callback/google`
- Database migrations must be run manually or via Railway CLI
- Railway PostgreSQL recommended for production database

**Edge Function Limitations**:
- Middleware is kept lightweight (manual JWT parsing) to stay under 1MB limit
- NextAuth imports in middleware cause bundle size issues - avoid them
