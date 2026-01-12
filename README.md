# CoachSync Web Application

A production-ready web application for fitness coaches and clients to track and view fitness data in real-time. Built with Next.js 16, TypeScript, and PostgreSQL.

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Authentication](#authentication)
- [Sample Users](#sample-users)
- [Project Structure](#project-structure)
- [API Routes](#api-routes)
- [Scripts](#scripts)
- [Deployment](#deployment)
- [Development Guidelines](#development-guidelines)

## Overview

CoachSync is a comprehensive fitness tracking platform that enables:

- **Coaches** to create cohorts, invite clients, and monitor client progress
- **Clients** to log daily fitness entries (weight, steps, calories)
- **Analytics** for coaches to track cohort performance and individual client trends
- **Role-based access control** with support for CLIENT, COACH, and ADMIN roles
- **Invitation system** for seamless client onboarding

## Tech Stack

### Frontend/Backend
- **Next.js 16.1.1** (App Router) with TypeScript
- **React 19.2.3** with Server Components
- **Tailwind CSS 4.1.18** for styling
- **Turbopack** (default bundler in Next.js 16)

### Authentication & Authorization
- **NextAuth.js v5** (Auth.js v5 beta) with JWT sessions
- **Google OAuth 2.0** (required)
- **Apple Sign-In** (optional)
- **Email/Password** authentication
- **Role-based access control** (CLIENT, COACH, ADMIN)

### Database & ORM
- **PostgreSQL** (via Railway)
- **Prisma 6.19.1** ORM
- **Prisma Adapter** for NextAuth

### Email Services
- **Resend** for transactional emails

### Data Visualization
- **Recharts 3.6.0** for analytics charts

## Features

### Client Features
- ✅ Daily fitness entry logging (weight, steps, calories)
- ✅ Personal dashboard with quick stats
- ✅ Entry history with visual tracking
- ✅ Automatic coach assignment via invitations
- ✅ Beautiful, responsive UI

### Coach Features
- ✅ Create and manage cohorts
- ✅ Invite clients via email (global and cohort-specific)
- ✅ Assign clients to cohorts
- ✅ View all client entries
- ✅ Analytics dashboard with cohort summaries
- ✅ Individual client analytics with sparklines
- ✅ Track weight changes, step averages, and calorie intake

### Admin Features
- ✅ User management
- ✅ Role assignment
- ✅ Password reset functionality
- ✅ Coach assignment management

### System Features
- ✅ Automatic email invitations
- ✅ Welcome emails for new users
- ✅ Test user support (emails suppressed)
- ✅ Error boundary handling
- ✅ Browser extension error suppression

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Railway recommended)
- Google Cloud Console account (for OAuth)
- Resend account (for emails)

### Installation

1. **Clone the repository** (if applicable)
   ```bash
   git clone <repository-url>
   cd CoachSync/Web
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables** (see [Environment Variables](#environment-variables))

4. **Set up the database** (see [Database Setup](#database-setup))

5. **Set up authentication** (see [Authentication](#authentication))

6. **Run the development server**
   ```bash
   npm run dev
   ```

7. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Environment Variables

### Local Development vs Production

**Important distinction:**

- **Local Development:** Use `.env.local` file (stored on your machine, git-ignored)
- **Production (Vercel):** Configure environment variables in Vercel Dashboard (not from files)

**Why `.env.local` doesn't work in production:**
- `.env.local` is git-ignored (won't be in your repository)
- Vercel doesn't read `.env.local` files from your repo
- Production platforms use their own environment variable system
- More secure: credentials are managed by the platform, not in files

### Local Development Setup

For local development, create a `.env.local` file in the root directory. **This file is git-ignored and will NOT be deployed to production.**

**Note:** Copy values from `.env.local` to Vercel Dashboard when deploying (see [Deployment](#deployment) section).

Create `.env.local` with the following variables:

### Required Variables

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-here  # Generate with: openssl rand -base64 32

# Google OAuth (Required)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Service (Resend)
RESEND_API_KEY=re_your-resend-api-key
```

### Optional Variables

```env
# Apple Sign-In (Optional)
APPLE_CLIENT_ID=your-apple-client-id
APPLE_CLIENT_SECRET=your-apple-client-secret
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY=your-apple-private-key

# Public Apple Client ID (for client-side rendering)
NEXT_PUBLIC_APPLE_CLIENT_ID=your-apple-client-id
```

## Database Setup

### 1. Create PostgreSQL Database

**Option A: Railway (Recommended)**
1. Go to [Railway](https://railway.app/)
2. Create a new project
3. Add a PostgreSQL database
4. Copy the connection string from the Variables tab

**Option B: Local PostgreSQL**
```bash
createdb coachsync
```

### 2. Run Database Migrations

```bash
npm run db:migrate
```

This will:
- Create all necessary tables
- Set up relationships and constraints
- Create indexes

### 3. Generate Prisma Client

```bash
npm run db:generate
```

### 4. Seed Test Users (Optional)

For development, seed test users:

```bash
npm run db:seed
```

This creates:
- `coach@test.local` (COACH role)
- `client@test.local` (CLIENT role)
- `noinvite@test.local` (CLIENT role, no cohort)
- `unassigned@test.local` (CLIENT role, pending invite)

### 5. Generate Test Data (Optional)

Generate comprehensive test data with cohorts, clients, and entries:

```bash
npm run test:generate
```

This creates:
- 1 coach user
- 5 cohorts
- 15 client users
- 12 active clients (distributed across cohorts)
- 3 pending invites
- 7-30 days of entries per client (realistic data)

## Authentication

### Google OAuth Setup (Required)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable **Google+ API**
4. Navigate to **APIs & Services** > **Credentials**
5. Click **Create Credentials** > **OAuth 2.0 Client ID**
6. Configure the consent screen if prompted
7. Set application type to **Web application**
8. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (local development)
   - `https://your-domain.vercel.app/api/auth/callback/google` (production)
9. Copy the **Client ID** and **Client Secret** to `.env.local`

### Apple Sign-In Setup (Optional)

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Create a Service ID
3. Configure Sign in with Apple
4. Add redirect URIs (same pattern as Google)
5. Generate a private key
6. Add all credentials to `.env.local`

### Email/Password Authentication

Users can sign up and log in with email/password. Passwords are hashed using bcrypt.

**Note:** Test users created by the seed script don't have passwords set. Use the `password:set` script to set passwords for test users (see [Scripts](#scripts) section).

## Sample Users

### Seed Script Users

After running `npm run db:seed`, the following test users are available:

| Email | Name | Role | Description |
|-------|------|------|-------------|
| `coach@test.local` | Test Coach | COACH | Full coach access, can create cohorts and invite clients |
| `client@test.local` | Test Client | CLIENT | Regular client, can log entries |
| `noinvite@test.local` | No Invite Client | CLIENT | Client without a coach assignment (for testing unassigned flow) |
| `unassigned@test.local` | Unassigned Client | CLIENT | Client with pending invite (for testing auto-assignment) |

**Login Instructions:**
1. These users don't have passwords set by default
2. Set a password using: `npm run password:set <email> <password>`
3. Example: `npm run password:set coach@test.local coach123`
4. Then login with email/password using the regular login form

### Test Data Users (After `npm run test:generate`)

**Coach:**
- Email: `coach@test.local`
- Name: Test Coach
- Role: COACH
- Can manage 5 cohorts

**Clients (15 total):**
All clients have email addresses ending in `@test.local`:

1. Sarah Johnson (`sarah.johnson@test.local`)
2. Michael Chen (`michael.chen@test.local`)
3. Emily Rodriguez (`emily.rodriguez@test.local`)
4. David Thompson (`david.thompson@test.local`)
5. Jessica Martinez (`jessica.martinez@test.local`)
6. James Wilson (`james.wilson@test.local`)
7. Amanda Davis (`amanda.davis@test.local`)
8. Robert Taylor (`robert.taylor@test.local`)
9. Lisa Anderson (`lisa.anderson@test.local`)
10. Christopher Brown (`christopher.brown@test.local`)
11. Michelle Garcia (`michelle.garcia@test.local`)
12. Daniel Lee (`daniel.lee@test.local`)
13. Jennifer White (`jennifer.white@test.local`)
14. Matthew Harris (`matthew.harris@test.local`)
15. Nicole Clark (`nicole.clark@test.local`)

**Distribution:**
- **12 Active Clients**: Distributed across 4 cohorts (3 clients per cohort)
- **3 Pending Invites**: One invite per cohort for the first 3 cohorts

**Cohorts:**
1. Spring 2024 Fitness Challenge (3 active clients, 1 pending invite)
2. Summer Transformation Program (3 active clients, 1 pending invite)
3. Fall Wellness Group (3 active clients, 1 pending invite)
4. Winter Bootcamp (3 active clients)
5. Year-Round Support (0 clients - empty cohort)

**Test Data:**
- Each active client has **7-30 days** of historical entries
- Realistic weight ranges: 120-180 lbs
- Step ranges: 8,000-13,000 steps/day
- Calorie ranges: 1,800-2,600 calories/day
- Data includes daily variations for realistic tracking

## Project Structure

```
CoachSync/Web/
├── app/                          # Next.js App Router
│   ├── admin/                   # Admin dashboard
│   ├── api/                     # API routes
│   │   ├── admin/              # Admin API endpoints
│   │   ├── auth/               # Authentication routes
│   │   ├── clients/            # Client management APIs
│   │   ├── coach-dashboard/    # Coach dashboard API
│   │   ├── cohorts/            # Cohort management APIs
│   │   ├── entries/            # Entry logging APIs
│   │   └── invites/            # Invitation APIs
│   ├── client-dashboard/        # Client dashboard page
│   ├── coach-dashboard/         # Coach dashboard page
│   ├── cohorts/                 # Cohort pages
│   ├── clients/                 # Client pages
│   ├── dashboard/               # Root dashboard redirect
│   ├── login/                   # Login page
│   ├── signup/                  # Signup page
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Home page (redirects)
│   └── globals.css             # Global styles
├── components/                   # React components
│   ├── SessionProvider.tsx     # NextAuth session provider
│   ├── ErrorBoundary.tsx       # Error boundary component
│   └── ui/                     # UI components
├── lib/                         # Utilities and configuration
│   ├── auth.ts                 # NextAuth configuration
│   ├── db.ts                   # Prisma client instance
│   ├── email.ts                # Email service (Resend)
│   ├── permissions.ts          # Role-based permissions
│   ├── types.ts                # TypeScript types
│   ├── utils.ts                # Helper functions
│   └── validations.ts          # Zod validation schemas
├── prisma/                      # Database schema and migrations
│   ├── schema.prisma           # Prisma schema definition
│   ├── seed.ts                 # Seed script for test users
│   └── migrations/             # Database migrations
├── scripts/                     # Utility scripts
│   ├── cleanup-orphaned-user.ts
│   ├── generate-test-data.ts   # Generate comprehensive test data
│   ├── migrate-roles-array.ts
│   ├── set-admin.ts            # Set admin role for user
│   ├── setup-broadcast-audience.ts
│   ├── setup-email-templates.ts
│   └── verify-resend-setup.ts
├── types/                       # TypeScript type definitions
│   └── next-auth.d.ts          # NextAuth type extensions
├── middleware.ts                # Next.js middleware (auth & routing)
├── next.config.js              # Next.js configuration
├── package.json                # Dependencies and scripts
├── tailwind.config.ts          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```

## API Routes

### Authentication
- `POST /api/auth/[...nextauth]` - NextAuth handlers
- `POST /api/auth/signup` - User signup

### Client Routes (CLIENT role required)
- `GET /api/entries` - Get user's entries
- `POST /api/entries` - Create new entry
- `GET /api/entries/check-membership` - Check if user has a coach

### Coach Routes (COACH role required)
- `GET /api/cohorts` - List all coach's cohorts
- `POST /api/cohorts` - Create new cohort
- `GET /api/cohorts/[id]` - Get cohort details (ownership required)
- `DELETE /api/cohorts/[id]` - Delete cohort (ownership required)
- `GET /api/cohorts/[id]/clients` - List clients in cohort
- `POST /api/cohorts/[id]/clients` - Invite client to cohort
- `GET /api/cohorts/[id]/analytics` - Get cohort analytics
- `GET /api/clients/[id]` - Get client details
- `GET /api/clients/[id]/entries` - Get client's entries
- `GET /api/clients/[id]/analytics` - Get client analytics
- `POST /api/clients/[id]/assign` - Assign client to cohort
- `GET /api/coach-dashboard/overview` - Get coach dashboard summary

### Invitation Routes (COACH role required)
- `GET /api/invites` - List all invitations
- `POST /api/invites` - Create global coach invite
- `GET /api/invites/[id]` - Get invite details
- `DELETE /api/invites/[id]` - Cancel invite

### Admin Routes (ADMIN role required)
- `GET /api/admin/users` - List all users
- `GET /api/admin/coaches` - List all coaches
- `POST /api/admin/coaches` - Invite new coach
- `GET /api/admin/cohorts` - List all cohorts
- `POST /api/admin/cohorts/[id]/assign-coach` - Assign coach to cohort
- `POST /api/admin/users/[id]/roles` - Update user roles
- `POST /api/admin/users/[id]/reset-password` - Reset user password

## Scripts

### Development
```bash
npm run dev              # Start development server (Turbopack)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
```

### Database
```bash
npm run db:generate      # Generate Prisma Client
npm run db:push          # Push schema changes to database
npm run db:migrate       # Run database migrations
npm run db:studio        # Open Prisma Studio (database GUI)
npm run db:seed          # Seed test users
```

### Test Data
```bash
npm run test:cleanup              # Remove all existing test data
npm run test:generate              # Generate basic test data (cohorts, clients, entries)
npm run test:generate-comprehensive # Generate comprehensive test data (200 clients, 10 coaches, varied health data)
```

See [TEST_DATA_DOCUMENTATION.md](./TEST_DATA_DOCUMENTATION.md) for detailed information about test data.

### Admin Utilities
```bash
npm run admin:set        # Set admin role for a user
npm run password:set     # Set password for a user (usage: npm run password:set <email> <password>)
```

### Email Setup
```bash
npm run email:setup-templates     # Setup email templates in Resend
npm run email:verify              # Verify Resend API key
npm run email:setup-audience      # Setup broadcast audience
```

## Deployment

### Vercel Deployment (Recommended)

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Import Project in Vercel**
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "Import Project"
   - Select your GitHub repository

3. **Configure Environment Variables in Vercel Dashboard**
   
   **⚠️ CRITICAL:** `.env.local` is NOT deployed to production. You must manually configure environment variables in Vercel's dashboard.
   
   Steps:
   1. Go to your project in [Vercel Dashboard](https://vercel.com/dashboard)
   2. Navigate to **Settings** → **Environment Variables**
   3. Add each variable individually:
   
   **Required Variables:**
   - `DATABASE_URL` - Copy the connection string from Railway
   - `NEXTAUTH_URL` - Set to your Vercel domain (e.g., `https://your-app.vercel.app`)
   - `NEXTAUTH_SECRET` - Use the same secret from your `.env.local` (or generate new: `openssl rand -base64 32`)
   - `GOOGLE_CLIENT_ID` - Copy from your `.env.local`
   - `GOOGLE_CLIENT_SECRET` - Copy from your `.env.local`
   - `RESEND_API_KEY` - Copy from your `.env.local`
   
   **Optional Variables (if using Apple Sign-In):**
   - `APPLE_CLIENT_ID`
   - `APPLE_CLIENT_SECRET`
   - `APPLE_TEAM_ID`
   - `APPLE_KEY_ID`
   - `APPLE_PRIVATE_KEY`
   - `NEXT_PUBLIC_APPLE_CLIENT_ID`
   
   **Environment Targeting:**
   - You can set different values for **Production**, **Preview**, and **Development** environments
   - Most variables should be set for all environments
   - `NEXTAUTH_URL` should be different for each environment (production domain vs localhost)
   
   **After adding variables:**
   - Variables are automatically available in your deployed app
   - You may need to redeploy for changes to take effect
   - Changes take effect on the next deployment

4. **Update Google OAuth Redirect URI**
   - Add production redirect URI in Google Cloud Console:
     `https://your-domain.vercel.app/api/auth/callback/google`

5. **Deploy**
   - Vercel will automatically deploy on push to main
   - Run migrations on first deploy (or manually)

### Railway Database

1. **Create PostgreSQL Database**
   - Go to [Railway](https://railway.app/)
   - Create new project
   - Add PostgreSQL database

2. **Copy Connection String**
   - Go to Variables tab
   - Copy `DATABASE_URL`
   - Add to Vercel environment variables

3. **Run Migrations**
   ```bash
   npm run db:migrate
   ```

Or use Railway's CLI:
```bash
railway run npm run db:migrate
```

## Development Guidelines

### Code Style
- Use TypeScript for all files
- Follow Next.js App Router conventions
- Use Server Components by default, Client Components when needed
- Use Tailwind CSS for styling
- Follow ESLint rules

### Database Changes
1. Update `prisma/schema.prisma`
2. Create migration: `npm run db:migrate`
3. Generate Prisma Client: `npm run db:generate`
4. Test changes locally

### Adding New Features
1. Create feature branch
2. Implement feature following existing patterns
3. Add API routes if needed
4. Update permissions if role-based access needed
5. Test with sample users
6. Create pull request

### Error Handling
- Use ErrorBoundary for React errors
- Handle API errors gracefully
- Log errors appropriately
- Show user-friendly error messages

### Testing
- Test with seed users in development
- Use `npm run test:generate` for comprehensive test data
- Test all user roles (CLIENT, COACH, ADMIN)
- Verify email suppression for test users

## Troubleshooting

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check SSL mode (should be `?sslmode=require` for Railway)
- Ensure database is accessible from your IP (if local)

### Authentication Issues
- Verify Google OAuth redirect URI matches exactly
- Check `NEXTAUTH_URL` matches your app URL
- Ensure `NEXTAUTH_SECRET` is set
- Check browser console for errors

### Test User Authentication
- Test users created by seed script don't have passwords set
- Use `npm run password:set <email> <password>` to set passwords
- After setting password, login with regular email/password form

### Email Issues
- Verify `RESEND_API_KEY` is set
- Test emails are suppressed for `isTestUser: true` users
- Check Resend dashboard for email status

## License

ISC

## Support

For issues and questions, please refer to the project documentation or contact the development team.

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Next.js Version:** 16.1.1
