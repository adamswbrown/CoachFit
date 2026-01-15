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
- **Authentication:** NextAuth.js v5 with JWT sessions. Roles (CLIENT, COACH, ADMIN) are stored in JWT and DB. See `lib/auth.ts`, `lib/permissions.ts`, and `middleware.ts` for role logic.
- **Middleware:** `middleware.ts` parses JWT manually for edge performance and enforces role-based access. Public assets and routes are explicitly allowed.
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
- **Role logic:** Use helpers in `lib/permissions.ts` and JWT parsing in `middleware.ts`.
- **Public assets:** Place in `public/` and reference with root-relative paths (e.g., `/logo.png`).
- **Environment:** All secrets/configs must be in `.env.local` (see `.env.example`).
- **Deployment:** Vercel (Next.js), Railway (Postgres). See `docs/development/deployment.md`.

## Examples
- To add a new feature: create React components, API routes, DB models/migrations, tests, and docs in one PR.
- To add a new role: update Prisma schema, `lib/permissions.ts`, `middleware.ts`, and docs.

For more, see `README.md`, `CLAUDE.md`, and `docs/`.
