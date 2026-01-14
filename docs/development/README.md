# Developer Guide

Complete guide for contributing to CoachFit development.

---

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](./getting-started.md)
3. [Architecture](./architecture.md)
4. [API Reference](./api-reference.md)
5. [Deployment](./deployment.md)
6. [Contributing](../misc/CONTRIBUTING.md)

---

## Overview

CoachFit is built with modern web technologies and follows a full-stack parallel execution operating contract. This guide will help you understand the codebase and contribute effectively.

### Current Status

- HealthKit ingestion APIs and coach-facing views are in development and may change.
- iOS app integration is planned but not yet shipped; see `../misc/IOS_APP_INTEGRATION_PLAN.md`.

### Tech Stack

**Frontend/Backend**:
- Next.js 16.1.1 (App Router) with React 19 Server Components
- TypeScript for type safety
- Tailwind CSS 4.1.18 for styling
- Turbopack for fast builds

**Database & Auth**:
- PostgreSQL via Railway
- Prisma 6.19.1 ORM
- NextAuth.js v5 with JWT sessions
- bcrypt password hashing

**Infrastructure**:
- Vercel for hosting
- Railway for PostgreSQL
- Resend for emails
- GitHub for version control and PR workflow

---

## Quick Links

### For New Developers

1. **[Getting Started](./getting-started.md)** - Set up your local development environment
2. **[Architecture Overview](./architecture.md)** - Understand the system design
3. **[API Reference](./api-reference.md)** - Learn about the API endpoints
4. **[Contributing Guide](../misc/CONTRIBUTING.md)** - How to contribute code

### Key Documentation

- **[CLAUDE.md](../../CLAUDE.md)** - AI-assisted development operating contract
- **[Database Schema](../../prisma/schema.prisma)** - Complete Prisma schema
- **[User Guide](../user-guide/README.md)** - End-user documentation

---

## Development Philosophy

CoachFit follows a **full-stack parallel execution operating contract**:

- **ALL development is parallel, full-stack batches**
- Every feature includes: frontend + backend + data + tests + docs
- Sequential thinking is forbidden
- **Momentum > perfection**

See [CLAUDE.md](../../CLAUDE.md) for the complete operating contract.

---

## Project Structure

```
CoachFit/Web/
├── app/                          # Next.js App Router
│   ├── admin/                   # Admin dashboard
│   ├── api/                     # API routes
│   ├── client-dashboard/        # Client dashboard
│   ├── coach-dashboard/         # Coach dashboard
│   ├── cohorts/                 # Cohort pages
│   └── clients/                 # Client pages
├── components/                   # React components
├── lib/                         # Utilities and configuration
│   ├── auth.ts                 # NextAuth configuration
│   ├── db.ts                   # Prisma client
│   ├── email.ts                # Email service
│   ├── permissions.ts          # Role-based permissions
│   └── validations.ts          # Zod schemas
├── prisma/                      # Database schema and migrations
├── scripts/                     # Utility scripts
├── docs/                        # Documentation
└── middleware.ts                # Next.js middleware

```

---

## Development Workflow

### Small/Medium Features (Direct PR)

1. Create feature branch: `git checkout -b feature/[name]`
2. Implement full batch (frontend + backend + data + tests)
3. Test locally with seed data
4. Create PR with complete description
5. Merge after review

### Large/Complex Features (Issue First)

1. Create GitHub issue with implementation guide
2. Discuss architectural approach
3. Refine plan based on feedback
4. Implement as batches
5. Create PR referencing issue

See [CLAUDE.md](../../CLAUDE.md) for detailed workflow.

---

## Key Concepts

### Role-Based Access Control

Three user roles:
- **CLIENT** - Track fitness data
- **COACH** - Manage clients and cohorts
- **ADMIN** - Platform administration

Users can have multiple roles (e.g., COACH + ADMIN).

### Invitation System

Two-tier invitation system:
1. **CoachInvite** - Global invite linking user to coach
2. **CohortInvite** - Cohort-specific invite auto-assigning to cohort

Both processed automatically on user sign-in.

### Entry Upsert Pattern

- One entry per user per day
- Uses Prisma upsert with unique constraint `[userId, date]`
- All fields optional - partial entries supported

---

## Common Commands

```bash
# Development
npm run dev              # Start dev server (Turbopack)
npm run build            # Production build
npm run lint             # Run ESLint

# Database
npm run db:generate      # Generate Prisma Client (after schema changes)
npm run db:migrate       # Run migrations
npm run db:studio        # Open Prisma Studio (database GUI)

# Test Data
npm run db:seed          # Create basic test users
npm run test:generate    # Generate full test dataset

# Admin Utilities
npm run admin:set [email]              # Grant admin role
npm run password:set [email] [password] # Set password
```

---

## Testing

### Manual Testing

Use seed data for local testing:

```bash
# Create test users
npm run db:seed

# Generate comprehensive test data
npm run test:generate

# Set passwords for test users
npm run password:set coach@test.local coach123
npm run password:set client@test.local client123
```

### Test User Credentials

After seeding:
- Coach: `coach@test.local` / `coach123`
- Client: `client@test.local` / `client123`

---

## Security

### Always Follow These Practices

- ✅ Validate all inputs with Zod schemas
- ✅ Check authentication on protected routes
- ✅ Verify authorization (roles/ownership)
- ✅ Never hard-code secrets
- ✅ Use Prisma for SQL injection protection
- ✅ Hash passwords with bcrypt (10 rounds)
- ✅ Expire JWT tokens (1-hour default)

See [CLAUDE.md](../../CLAUDE.md) for complete security baseline.

---

## Next Steps

1. **[Set up your development environment](./getting-started.md)**
2. **[Learn the architecture](./architecture.md)**
3. **[Review the API](./api-reference.md)**
4. **[Read the operating contract](../../CLAUDE.md)**
5. **[Start contributing](../misc/CONTRIBUTING.md)**

---

**Last Updated**: January 2025
