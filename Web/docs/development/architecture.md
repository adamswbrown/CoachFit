# Architecture Overview

Complete guide to CoachFit's system architecture and design patterns.

---

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [Authentication & Authorization](#authentication--authorization)
4. [API Design Patterns](#api-design-patterns)
5. [Frontend Architecture](#frontend-architecture)
6. [Key Technical Decisions](#key-technical-decisions)

---

## System Architecture

### Tech Stack

**Frontend/Backend**:
- Next.js 16.1.1 App Router (React 19 Server Components)
- TypeScript for end-to-end type safety
- Tailwind CSS 4.1.18 for styling
- Turbopack for fast development builds

**Database & ORM**:
- PostgreSQL (production-grade relational database)
- Prisma 6.19.1 ORM with type-safe queries
- Railway for hosted PostgreSQL

**Authentication**:
- Clerk (managed auth — no self-hosted auth infrastructure)
- Providers: Google OAuth, Email/Password (configured in Clerk Dashboard)
- Session management handled entirely by Clerk (cookie-based)

**Infrastructure**:
- Vercel for hosting and automatic deployments
- Railway for PostgreSQL database
- Resend for transactional emails
- GitHub for version control and PR workflow

### Application Layers

```
┌─────────────────────────────────────┐
│     Frontend (React Components)     │
│   - Client Dashboard                │
│   - Coach Dashboard                 │
│   - Admin Dashboard                 │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│      API Routes (Next.js API)       │
│   - Authentication Check            │
│   - Authorization Check             │
│   - Input Validation (Zod)          │
│   - Business Logic                  │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│      Data Layer (Prisma ORM)        │
│   - Type-safe queries               │
│   - Migrations                      │
│   - Database client                 │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│     Database (PostgreSQL)           │
│   - User data                       │
│   - Entries                         │
│   - Cohorts & Memberships           │
└─────────────────────────────────────┘
```

---

## Database Schema

### Core Models

**User**:
- Central entity with roles array (CLIENT, COACH, ADMIN)
- Supports multiple authentication providers
- Can have multiple roles simultaneously

**Cohort**:
- Groups of clients managed by a coach
- Has optional CohortCheckInConfig for custom prompts
- One-to-many relationship with CohortMemberships

**CohortMembership**:
- Join table linking User (CLIENT) to Cohort
- Composite key: `[userId, cohortId]`
- Cascade deletes when user or cohort is deleted

**Entry**:
- Daily fitness data submitted by clients
- Core fields: weight, steps, calories, sleep quality, perceived effort, notes
- Custom responses (JSON) for coach-defined prompts
- Unique constraint: `[userId, date]` (one entry per user per day)

**CoachInvite & CohortInvite**:
- Two-tier invitation system
- Auto-processed on user sign-in
- Deleted after processing

**CoachNote**:
- Weekly coach notes for clients
- Unique constraint: `[coachId, clientId, weekStart]`

**AdminInsight, AttentionScore, AdminAction**:
- Admin dashboard features
- Auto-generated insights and scoring
- Audit trail for compliance

### Entity Relationships

```
User
  ├── roles: Role[]
  ├── invitedByCoachId: String?
  ├── Entries: Entry[]
  ├── CohortMemberships: CohortMembership[]
  ├── Cohorts (as coach): Cohort[]
  └── CoachNotes: CoachNote[]

Cohort
  ├── coachId: String
  ├── CohortMemberships: CohortMembership[]
  ├── CohortInvites: CohortInvite[]
  └── CohortCheckInConfig: CohortCheckInConfig?

Entry
  ├── userId: String
  ├── date: DateTime
  ├── weightLbs, steps, calories, sleepQuality, perceivedStress, notes
  └── customResponses: Json?
```

See [prisma/schema.prisma](../../prisma/schema.prisma) for complete schema.

---

## Authentication & Authorization

### Authentication Flow

1. **Sign In**:
   - User chooses provider (Google or Email/Password)
   - Clerk handles authentication (managed service)
   - Session managed by Clerk (cookie-based, automatic rotation)

2. **User Sync** (via Clerk webhook):
   - `user.created` event → creates local DB user, processes invites, sends welcome email
   - `user.updated` event → syncs email/name changes
   - If webhook hasn't fired, `getSession()` auto-creates local user on first API call

3. **Role Assignment**:
   - New users default to CLIENT role
   - Roles stored in database (source of truth) and synced to Clerk `publicMetadata`
   - Admin can grant additional roles (COACH, ADMIN)

### Authorization Patterns

**Middleware (proxy.ts)**:
- Clerk middleware (`clerkMiddleware()`) for route protection
- `createRouteMatcher()` defines public routes
- Adds security headers and CORS

**API Route Protection**:
```typescript
// Authentication check
const session = await getSession()
if (!session?.user?.id) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}

// Authorization check (role-based)
import { isCoach, isAdmin } from "@/lib/permissions"
if (!isCoach(session.user)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// Ownership check
if (resource.coachId !== session.user.id && !isAdmin(session.user)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

### Device Token Auth (iOS Companion App)

In addition to Clerk session auth, the platform supports **device token authentication** for iOS app endpoints:

- iOS app pairs via POST /api/pair using an 8-char pairing code
- On success, a 64-char hex device token is generated and returned
- iOS app sends `X-Pairing-Token: <device_token>` header on all ingest API calls
- `validateIngestAuth()` in `lib/security/ingest-auth.ts` handles dual auth (pairing code or device token)
- Token revocation: clearing `deviceToken` on the PairingCode record invalidates the session

### Role-Based Access Control

- **CLIENT**: Submit entries, view own data
- **COACH**: Create cohorts, invite clients, view analytics
- **ADMIN**: Manage users, assign roles, system-wide access

**Important**: ADMIN doesn't replace COACH. Users need COACH role to manage cohorts.

---

## API Design Patterns

### Standard Response Structure

```typescript
// Success
return NextResponse.json({ data: result })

// Error
return NextResponse.json({ error: "Error message" }, { status: 400 })
```

### Input Validation

All API inputs validated with Zod schemas:

```typescript
import { upsertEntrySchema } from "@/lib/validations"

const body = await request.json()
const parsed = upsertEntrySchema.safeParse(body)

if (!parsed.success) {
  return NextResponse.json(
    { error: "Validation failed", details: parsed.error.errors },
    { status: 400 }
  )
}
```

### Common Patterns

**Entry Upsert**:
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

**Cohort Access Verification**:
```typescript
const cohort = await db.cohort.findUnique({
  where: { id: params.id }
})

if (!cohort) {
  return NextResponse.json({ error: "Not found" }, { status: 404 })
}

if (cohort.coachId !== session.user.id && !isAdmin(session.user)) {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}
```

---

## Frontend Architecture

### App Router Structure

```
app/
├── client-dashboard/       # Client views
├── coach-dashboard/        # Coach views
├── admin/                  # Admin views
├── cohorts/[id]/          # Cohort details
├── clients/[id]/          # Client details (coach perspective)
│   ├── entries/           # Entry history
│   ├── training/          # Training tab (workout visualization)
│   ├── weekly-review/     # Weekly review (conditional — cohort members only)
│   └── settings/          # Client settings
└── api/                   # API routes
```

**Client Detail Tabs** (`/clients/[id]/...`):
- **Overview** — Client summary and analytics
- **Entries** — Check-in entry history
- **Weekly Review** — Conditional: only shown if client has a CohortMembership (enrolled in a cohort)
- **Training** — Workout visualization: summary stats, weekly volume bar chart, workout type breakdown donut chart, full workout list. Uses GET /api/healthkit/workouts.
- **Settings** — Client account settings

Independent gym members (not enrolled in any cohort) see: Overview, Entries, Training, Settings.

### Server vs Client Components

**Default to Server Components**:
- Fetch data directly from database
- No client-side JavaScript bundle
- Better performance and SEO

**Use Client Components for**:
- Interactive forms (`"use client"`)
- Charts and visualizations (Recharts)
- Browser APIs (localStorage, etc.)
- State management (useState, useReducer)

### Component Patterns

**Server Component** (default):
```typescript
// app/dashboard/page.tsx
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function DashboardPage() {
  const session = await getSession()
  const data = await db.entry.findMany({
    where: { userId: session.user.id }
  })

  return <div>{/* Render */}</div>
}
```

**Client Component**:
```typescript
"use client"

import { useState } from "react"

export default function EntryForm() {
  const [weight, setWeight] = useState("")
  // Interactive logic
  return <form>{/* Form */}</form>
}
```

---

## Key Technical Decisions

### 1. Next.js 16 App Router

**Why**:
- Server Components for optimal performance
- Streaming for faster page loads
- Built-in API routes
- Turbopack for fast development

**Trade-offs**:
- Learning curve for Server/Client Component distinction
- Some libraries not yet compatible with Server Components

### 2. Prisma ORM

**Why**:
- Type-safe database queries
- Excellent migration tools
- Great TypeScript integration
- Active community and ecosystem

**Trade-offs**:
- Generates large client bundle (acceptable for server-side use)
- Migration workflow requires discipline

### 3. Clerk (Managed Auth)

**Why**:
- Zero self-hosted auth infrastructure (no Google Cloud Console, no session tables)
- Google OAuth configured entirely in Clerk Dashboard
- Free tier supports 10,000 monthly active users
- Pre-built UI components (`<SignIn />`, `<SignUp />`)

**Trade-offs**:
- External dependency (managed service)
- Multi-role not natively supported (solved via DB + publicMetadata sync)

### 4. Clerk Middleware

**Decision**: Use `clerkMiddleware()` for route protection

**Why**:
- Handles session validation automatically
- No manual JWT parsing needed
- Clean route matching with `createRouteMatcher()`

### 5. Two-Tier Invitation System

**Decision**:
- CoachInvite for global coach-client linking
- CohortInvite for specific cohort assignment

**Why**:
- Flexibility: invite first, assign to cohort later
- Automatic processing on sign-in reduces manual steps
- Supports different onboarding workflows

### 6. Role Arrays

**Decision**: Users can have multiple roles (e.g., COACH + ADMIN)

**Why**:
- Real-world flexibility (admins who also coach)
- Explicit role checks prevent implicit assumptions
- Clear separation: ADMIN ≠ COACH

### 7. Entry Upsert Pattern

**Decision**: One entry per user per day via unique constraint

**Why**:
- Simplifies UI (update instead of create new)
- Prevents duplicate entries
- Clear data model

### 8. Test User Pattern

**Decision**: `isTestUser` flag for email suppression

**Why**:
- Safe development without spamming real emails
- Easy to identify test accounts
- Doesn't block user flows

---

## Security Architecture

### Defense in Depth

1. **Input Validation**: Zod schemas on all API inputs
2. **SQL Injection Protection**: Prisma parameterized queries
3. **XSS Protection**: React automatic escaping
4. **Authentication**: Clerk managed auth (sessions, OAuth, passwords)
5. **Authorization**: Role-based access control
6. **Password Security**: Managed by Clerk (no self-hosted password storage)
7. **Session Security**: Managed by Clerk (automatic token rotation)
8. **Secrets Management**: Environment variables only

### Security Checklist (Every API Route)

- [ ] Authentication check (`await getSession()`)
- [ ] Authorization check (role/ownership)
- [ ] Input validation (Zod schema)
- [ ] Error messages don't leak sensitive info
- [ ] Database queries use Prisma (no raw SQL)

---

## Performance Considerations

- **Server Components**: Reduce client-side JavaScript
- **Turbopack**: Fast development builds
- **Database Indexes**: On frequently queried fields
- **Clerk Sessions**: No manual session management needed
- **Prisma Connection Pooling**: Efficient database connections

---

## Next Steps

- **[Review API Reference](./api-reference.md)**
- **[Read Operating Contract](../../CLAUDE.md)**
- **[Deploy to Production](./deployment.md)**

---

**Last Updated**: March 2026
