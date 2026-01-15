# Copilot Instructions for CoachFit

## 🚀 Project Philosophy
- **Parallel, full-stack batches:** Every feature/change must include frontend, backend, data, tests, docs, and deployment. Never ship partial/incremental slices.
- **One coherent system slice per change:** Think like a team—product, architecture, frontend, backend, data, QA, and DevOps are all considered together.
- **MVP > Perfection:** Ship working, testable features before refining.

## 🏗️ Architecture Overview
- **Framework:** Next.js 16 (App Router, React 19 Server Components)
- **Type Safety:** TypeScript everywhere
- **Styling:** Tailwind CSS 4.x
- **Database:** PostgreSQL (via Prisma ORM)
- **Auth:** NextAuth.js v5 (JWT, multi-provider)
- **Infra:** Vercel (hosting), Railway (DB), Resend (email)

## 📁 Key Structure & Patterns
- `app/` — App Router structure: client-dashboard, coach-dashboard, admin, cohorts/[id], clients/[id], API routes
- `components/` — UI, icons, admin widgets, layouts, and shared UI
- `lib/` — Auth, DB, validation, permissions, utilities
- `prisma/schema.prisma` — Source of truth for data models
- `middleware.ts` — Lightweight JWT-based route protection (no NextAuth imports)
- **Server Components by default:** Use client components only for interactivity (forms, charts, browser APIs)
- **API input validation:** All API routes use Zod schemas from `lib/validations.ts`
- **Role-based access:** Use helpers from `lib/permissions.ts` for CLIENT, COACH, ADMIN checks
- **Entry upsert:** One entry per user per day (unique constraint)


## 🛠️ Developer Workflows
- **Major changes:** Any work that requires a new feature, architectural change, data model update, compliance/regulatory work, or impacts multiple parts of the system (see examples in current GitHub issues: GDPR compliance, new review queues, iOS HealthKit integration). For these, create a detailed implementation plan and file it as a GitHub issue before starting work. All work should reference and close the relevant issue.
- **Small changes:** Anything outside the above scope (e.g., updating images, text, minor UI tweaks, or isolated bug fixes). Document the change clearly in the pull request description and merge directly to the appropriate domain branch.
- **Local dev:** See `docs/development/getting-started.md` for setup
- **Build:** `next build` (Turbopack)
- **Run:** `next dev` for local, Vercel for prod
- **DB Migrate:** `npx prisma migrate dev` (see `prisma/`)
- **Seed data:** `npx prisma db seed` or scripts in `scripts/`
- **Test:** (add test details if present)
- **Deploy:** Vercel auto-deploys from `main` branch

## 🧩 Conventions & Decisions
- **All roles are additive:** ADMIN ≠ COACH; assign both for admin-coaches
- **Invitations:** Two-tier (CoachInvite, CohortInvite), auto-processed on sign-in
- **Test users:** Use `isTestUser` flag to suppress real emails
- **No raw SQL:** Use Prisma for all DB access
- **Security:** Auth, role, and input validation required for every API route

## 📚 Reference Files
- `README.md` — Project intro, links to docs
- `docs/development/architecture.md` — System design, patterns, and rationale
- `CLAUDE.md` — AI operating contract and philosophy
- `prisma/schema.prisma` — Data model
- `lib/permissions.ts`, `lib/validations.ts` — Role and validation helpers
- `middleware.ts` — Route protection logic

---

**For more, see:**
- `docs/development/README.md` (dev guide)
- `docs/user-guide/README.md` (user guide)
- `docs/development/architecture.md` (architecture)
- `CLAUDE.md` (AI contract)

_Last updated: January 2026_
