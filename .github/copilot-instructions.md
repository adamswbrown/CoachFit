# Copilot Instructions for CoachFit

This file guides AI agents in contributing to CoachFit, a Next.js fitness coaching platform.

## Project Overview

**CoachFit** connects coaches with clients for real-time health tracking. Built with Next.js 16 (App Router), TypeScript, Prisma ORM, PostgreSQL, and NextAuth.js v5.

**Core domains:**
- **Clients**: Submit daily fitness entries (weight, steps, calories, sleep, effort)
- **Coaches**: Manage cohorts, invite clients, track progress with analytics and weekly notes
- **Admins**: User management, system overview, audit trails

## Architecture & Critical Patterns

### Authentication & Authorization (lib/auth.ts, lib/permissions.ts)

**Multi-role system:**
- User `roles` array: CLIENT, COACH, ADMIN (a user can have multiple roles)
- **Key rule**: ADMIN does NOT replace COACH. Users must have COACH role to manage cohorts
- JWT sessions: 1-hour expiration with role data embedded in token
- Multiple providers: Google OAuth, Apple Sign-In, Email/Password (Credentials)

**Authorization pattern (all protected routes):**
```typescript
const session = await auth()
if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

// For coach routes
import { isCoach } from "@/lib/permissions"
if (!isCoach(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

// For routes allowing both admin and coach
import { isAdminOrCoach } from "@/lib/permissions"
```

### Two-Tier Invitation System

**Data model constraint**: CoachInvite + CohortInvite are processed automatically on sign-in, then deleted.

**Two paths to join:**
1. **CoachInvite** (global): Coach invites client by email → sets `invitedByCoachId` → client appears in "unassigned clients"
2. **CohortInvite** (cohort-specific): Coach invites to specific cohort → creates CohortMembership automatically on sign-in

**Processing** happens in `lib/auth.ts` `callbacks.signIn()` - both invite types are handled automatically.

### Entry Model (One Entry Per Day)

```typescript
Entry {
  userId, date, weightLbs, steps, calories     // core fields
  sleepQuality, perceivedStress, notes         // phase 2 fields
  customResponses (JSON)                        // coach-defined prompts per cohort
  dataSources (JSON, default [])               // track HealthKit vs manual entries
  
  Unique constraint: [userId, date]            // one entry per user per day
}
```

Use `upsert` for entries - this is the standard pattern.

### API Response Structure

All endpoints follow this pattern:
```typescript
// Success
return NextResponse.json({ data: result })

// Error
return NextResponse.json({ error: "Error message" }, { status: 400 })
```

### Email Service (lib/email.ts)

- Uses Resend for transactional emails
- **Test user suppression**: Emails for `isTestUser: true` are logged, never sent
- Gracefully handles missing API key (doesn't block user flows)
- Three email types: welcome, cohort invitations, global coach invitations

## Development Workflow

### Full-Stack Batches Required

**Non-negotiable rule**: Every feature ships as one complete batch.

Include in every batch:
- ✅ Product intent & scope decision
- ✅ Frontend component(s)
- ✅ Backend API route(s) with validation
- ✅ Database schema changes (with migrations if needed)
- ✅ Tests (minimum coverage: happy path + error cases)
- ✅ Documentation updates
- ✅ Deployment implications

### Common Commands

```bash
# Development
npm run dev                    # Start dev server (Turbopack)
npm run build                  # Build for production
npm run lint                   # Run ESLint

# Database
npm run db:generate            # Generate Prisma Client (after schema changes)
npm run db:migrate             # Run migrations
npm run db:push                # Push schema changes (prototyping only)
npm run db:studio              # Open Prisma Studio (database GUI)
npm run db:seed                # Seed basic test users

# Test Data
npm run test:generate          # Generate 15 clients, 5 cohorts
npm run test:generate-comprehensive  # Generate 200 clients, 10 coaches
npm run test:cleanup           # Remove all test data

# Admin Utilities
npm run admin:set [email]      # Grant admin role
npm run password:set [email] [password]  # Set password for user
```

### Testing Pattern

- Test API endpoints with proper authentication and authorization checks
- Use sample data from seed/test scripts
- Test error cases: missing auth, wrong role, resource not found, validation failures

### PR Workflow

1. Create feature branch: `git checkout -b feature/[name]`
2. Implement full batch (frontend + backend + data + tests)
3. Create PR with complete description
4. Merge after review

## Key Files to Know

| File | Purpose |
|------|---------|
| [lib/auth.ts](../Web/lib/auth.ts) | NextAuth configuration, provider setup, invitation processing |
| [lib/permissions.ts](../Web/lib/permissions.ts) | Role-based permission helpers (isAdmin, isCoach, isClient) |
| [lib/validations.ts](../Web/lib/validations.ts) | Zod schemas for all API inputs |
| [prisma/schema.prisma](../Web/prisma/schema.prisma) | Complete data model with relationships |
| [app/api/](../Web/app/api/) | API endpoints organized by resource |
| [app/](../Web/app/) | Frontend pages and layouts (App Router) |
| [components/](../Web/components/) | Reusable React components |

## Frontend Architecture (Next.js App Router)

**Directory structure:**
```
app/
├── api/                      # API routes by resource
├── client-dashboard/         # Client views
├── coach-dashboard/          # Coach views
├── admin/                    # Admin views
├── cohorts/[id]/             # Cohort details
├── clients/[id]/             # Client view (coach perspective)
├── login/ & signup/          # Auth pages
└── onboarding/               # Onboarding flow
```

**Component patterns:**
- Default to Server Components for data fetching
- Use `"use client"` only when needed for interactivity
- Organize component code by feature in `components/` subdirectories

## Common Gotchas

1. **Role confusion**: ADMIN ≠ COACH. Users need COACH role to create cohorts. Admins can be created with only the ADMIN role (no COACH or CLIENT). ADMIN does not imply COACH permissions or access to coach features.
2. **Invitations are auto-deleted**: After processing on sign-in, CoachInvite and CohortInvite are removed from DB.
3. **Entry upserts**: Always use upsert pattern for entries (update if exists, create if not).
4. **Test user emails**: Suffix with `.local` or set `isTestUser: true` to suppress emails.
5. **Ownership checks**: Coaches can only see their own cohorts (unless admin).
6. **Session duration**: JWT sessions expire after 1 hour - consider impact for long-running operations.

## External Dependencies

- **Vercel**: Hosting and auto-deployment
- **Railway**: PostgreSQL database
- **Resend**: Transactional emails
- **NextAuth.js v5**: Authentication with multiple providers

## When Starting a New Feature

1. **Read existing pattern first**: Check similar features in the same domain
2. **Check auth requirements**: Is this client-only, coach-only, admin-only?
3. **Design data shape**: Will you need schema changes? Use Prisma Studio to explore
4. **Write validation schema**: Add Zod schema to [lib/validations.ts](../Web/lib/validations.ts)
5. **Implement as batch**: Frontend + Backend + Data + Tests together
6. **Test with seed data**: Use `npm run test:generate` for realistic test environment

## Documentation

Full developer docs available in [/docs/development/](../Web/docs/development/):
- Architecture deep-dive
- API reference
- Deployment guide
- Contributing guide

See [CLAUDE.md](../Web/CLAUDE.md) for the complete operating contract and development philosophy.
