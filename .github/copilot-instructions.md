# Copilot Instructions for CoachFit


**Feature Planning Workflow:**
- For big features, always start by creating a detailed GitHub issue. Big features are those that require multi-phase implementation, cross multiple domains (frontend, backend, data, docs), or have a significant impact on users or compliance. See examples like:
  - [GDPR Compliance Implementation](https://github.com/adamswbrown/CoachFit/issues/15)
  - [Weekly Coach Review Queue + Copyable Email Draft](https://github.com/adamswbrown/CoachFit/issues/14)
  - [iOS App Integration: HealthKit Automatic Data Sync](https://github.com/adamswbrown/CoachFit/issues/3)
- These issues should include: overview, goals, current state, proposed implementation, acceptance criteria, and follow-ups.
- Big features must be PR'd from the issue and reference the issue in the PR.
- For smaller features or fixes, plan directly in a pull request with a complete PR description (no separate issue needed).
- All PRs must include full-stack, test-covered, and documented changes as described below.
- Use a fresh branch + PR per issue/feature; never commit to `ci/remove-claude-workflow`.

## Project Overview
CoachFit is a full-stack fitness coaching platform built with Next.js 16 (App Router), TypeScript, Prisma ORM, PostgreSQL, and NextAuth.js v5. The system connects coaches and clients for real-time health tracking, cohort management, and progress analytics.

## Architecture & Key Patterns
- **Parallel Full-Stack Batches:** All features are delivered as complete vertical slices: frontend, backend, data, tests, docs, and deployment. Never implement only part of a feature.
- **App Structure:**
  - `app/` — Next.js App Router pages and API routes
  - `components/` — Reusable React components (including icons, layouts, admin widgets)
  - `lib/` — Auth, permissions, utilities, and business logic
  - `prisma/` — Prisma schema, migrations, and seed scripts
  - `public/` — Static assets (images, logos)
  - `scripts/` — Admin/test utilities (run with `npx tsx`)
  - `docs/` — User and developer documentation
- **Authentication:** NextAuth.js v5 with JWT sessions. Roles (CLIENT, COACH, ADMIN) are stored in JWT and DB. See `lib/auth.ts` and `lib/permissions.ts` for role logic and authorization helpers.
- **Database:** Prisma models in `prisma/schema.prisma`. Users can have multiple roles. Cohorts, entries, and invites are core models.
- **Testing:** Use Playwright for E2E (`tests/`), and scripts in `scripts/` for data setup/cleanup.
- **Docs:** All features must update docs in `docs/` and/or `README.md` as part of the batch.

## Developer Workflows
- **Dev server:** `npm run dev` (Turbopack)
- **Build:** `npm run build` / `npm run start`
- **Lint:** `npm run lint`
- **DB:** `npm run db:generate`, `npm run db:migrate`, `npm run db:seed`, etc.
- **Test data:** `npm run test:generate`, `npm run test:cleanup`
- **Admin:** `npm run admin:set <email>`, `npm run password:set <email> <password>`
- **Email:** `npm run email:setup-templates`, `npm run email:verify`

## Project Conventions
- **No sequential/incremental delivery:** Always ship full-stack, test-covered, and documented feature slices.
- **Role logic:** Use helpers in `lib/permissions.ts` for role-based authorization checks.
- **Public assets:** Place in `public/` and reference with root-relative paths (e.g., `/logo.png`).
- **Environment:** All secrets/configs must be in `.env.local` (see `.env.example`).
- **Deployment:** Vercel (Next.js), Railway (Postgres). See `docs/development/deployment.md`.

## Code Quality Standards
- **TypeScript:** Use strict typing; avoid `any` types. Leverage Prisma-generated types for database models.
- **Validation:** All API inputs must be validated with Zod schemas (see `lib/validations/`).
- **Error Handling:** API routes return structured errors: `{ error: "message" }` with appropriate HTTP status codes.
- **Server vs Client Components:** Default to Server Components; use `"use client"` only when needed (forms, interactivity, browser APIs).
- **Imports:** Use `@/` path alias for imports (e.g., `import { db } from "@/lib/db"`).

## Security Best Practices
- **Authentication:** Every protected API route must call `await auth()` and validate `session?.user?.id`.
- **Authorization:** Use `isAdmin()`, `isCoach()`, `isClient()` from `lib/permissions.ts` for role checks.
- **Ownership:** Verify users own resources before allowing access (e.g., coach owns cohort).
- **Input Validation:** Never trust client input; always validate with Zod schemas.
- **Password Hashing:** Use bcrypt (10 rounds) via `lib/auth.ts` patterns.
- **SQL Injection:** Protected by Prisma ORM parameterized queries.
- **XSS Protection:** React automatic escaping handles this; avoid `dangerouslySetInnerHTML`.

## Examples
- To add a new feature: create React components, API routes, DB models/migrations, tests, and docs in one PR.
- To add a new role: update Prisma schema, `lib/permissions.ts`, and docs.

## Common Patterns

### API Route Structure
```typescript
// app/api/resource/route.ts
import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isCoach } from "@/lib/permissions"
import { db } from "@/lib/db"

export async function GET(request: Request) {
  // 1. Authenticate
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // 2. Authorize (if needed)
  if (!isCoach(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // 3. Business logic with Prisma
  const data = await db.model.findMany({ where: { userId: session.user.id } })

  // 4. Return structured response
  return NextResponse.json({ data })
}
```

### Database Queries
- Use Prisma Client from `@/lib/db` (singleton instance)
- Include related data with `include` option
- Filter with `where` clause
- Sort with `orderBy`

### Component Patterns
- Server Components for data fetching (no "use client")
- Client Components for forms and interactivity ("use client" at top)
- Use `SessionProvider` wrapper for client components needing auth
- Tailwind CSS for all styling (no inline styles)

## Anti-Patterns to Avoid
- ❌ Don't implement backend without frontend (or vice versa)
- ❌ Don't skip input validation on API routes
- ❌ Don't hard-code secrets or credentials
- ❌ Don't use `any` type in TypeScript
- ❌ Don't commit test data, build artifacts, or dependencies
- ❌ Don't forget to run migrations after schema changes
- ❌ Don't mix authentication providers without proper user merge logic

For more, see `README.md`, `CLAUDE.md`, and `docs/`.
