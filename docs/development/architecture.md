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
- NextAuth.js v5 with JWT sessions (1-hour duration)
- Multi-provider: Google OAuth, Apple Sign-In, Email/Password
- bcrypt password hashing (10 rounds)

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
   - User chooses provider (Google/Apple/Email)
   - NextAuth handles authentication
   - JWT token created with user ID and roles
   - Session stored in cookie (1-hour expiration)

2. **Invitation Processing** (callbacks.signIn):
   - Check for CoachInvite → set `invitedByCoachId`
   - Check for CohortInvite → create CohortMembership
   - Delete processed invites

3. **Role Assignment**:
   - New users default to CLIENT role
   - Roles stored in both database and JWT
   - Admin can grant additional roles (COACH, ADMIN)

### Authorization Patterns

**Middleware (middleware.ts)**:
- Lightweight JWT parsing (no NextAuth imports)
- Route protection based on roles
- Redirects unauthorized users to login

**API Route Protection**:
```typescript
// Authentication check
const session = await auth()
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
├── clients/[id]/          # Client details
└── api/                   # API routes
```

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
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export default async function DashboardPage() {
  const session = await auth()
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

### 3. NextAuth.js v5

**Why**:
- Multi-provider authentication out of the box
- Flexible JWT or database sessions
- Good documentation and community support

**Trade-offs**:
- v5 is beta (but stable enough for production)
- Complex configuration for multiple providers

### 4. Lightweight Middleware

**Decision**: Manual JWT parsing in middleware to avoid Edge Function size limits

**Why**:
- NextAuth imports cause bundle bloat
- Edge Functions have 1MB limit
- Simple JWT parsing is sufficient for route protection

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
4. **Authentication**: NextAuth with secure JWT
5. **Authorization**: Role-based access control
6. **Password Security**: bcrypt hashing (10 rounds)
7. **Session Security**: 1-hour JWT expiration
8. **Secrets Management**: Environment variables only

### Security Checklist (Every API Route)

- [ ] Authentication check (`await auth()`)
- [ ] Authorization check (role/ownership)
- [ ] Input validation (Zod schema)
- [ ] Error messages don't leak sensitive info
- [ ] Database queries use Prisma (no raw SQL)

---

## Performance Considerations

- **Server Components**: Reduce client-side JavaScript
- **Turbopack**: Fast development builds
- **Database Indexes**: On frequently queried fields
- **JWT Sessions**: No database lookup on every request
- **Prisma Connection Pooling**: Efficient database connections

---

## Next Steps

- **[Review API Reference](./api-reference.md)**
- **[Read Operating Contract](../../CLAUDE.md)**
- **[Deploy to Production](./deployment.md)**

---

**Last Updated**: January 2025
