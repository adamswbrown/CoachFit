# Authentication Setup Guide

CoachFit uses [Better Auth](https://better-auth.com) for authentication, supporting Google OAuth and email/password login.

---

## Overview

- **Library**: Better Auth (replaced NextAuth.js v5 beta)
- **Session strategy**: Database-backed sessions (PostgreSQL via Prisma)
- **Providers**: Google OAuth, email/password
- **Account linking**: Enabled — Google and email/password accounts with the same email are automatically linked
- **Session duration**: 1 hour (refreshed every 5 minutes)

---

## Environment Variables

Add these to `.env.local` (local development) or your hosting provider (production):

```env
# Better Auth (Required)
BETTER_AUTH_URL=http://localhost:3000          # Your app URL
BETTER_AUTH_SECRET=your-secret-here            # Generate with: openssl rand -base64 32

# Google OAuth (Required)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database (Required)
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

### Legacy Fallbacks

Better Auth config falls back to these if `BETTER_AUTH_*` vars are not set:

- `BETTER_AUTH_URL` → `NEXTAUTH_URL`
- `BETTER_AUTH_SECRET` → `AUTH_SECRET` → `NEXTAUTH_SECRET`

This means existing deployments with NextAuth env vars will continue to work without changes.

---

## Google OAuth Setup

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google+ API** (or "Google Identity" API)

### 2. Create OAuth Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth 2.0 Client ID**
3. Select **Web application** as the application type
4. Set a name (e.g., "CoachFit")

### 3. Configure Redirect URIs

Add these **Authorized redirect URIs**:

```
# Local development
http://localhost:3000/api/auth/callback/google

# Production (replace with your domain)
https://your-domain.com/api/auth/callback/google
```

**Important**: Better Auth uses the same callback path as NextAuth (`/api/auth/callback/google`), so existing Google Cloud configurations work without changes.

### 4. Copy Credentials

Copy the **Client ID** and **Client Secret** into your environment variables:

```env
GOOGLE_CLIENT_ID=123456789-abcdefg.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-secret-here
```

---

## Email/Password Setup

Email/password authentication works out of the box. No additional configuration needed.

### Password Requirements

- Minimum: 8 characters
- Maximum: 128 characters
- Hashing: bcrypt (12 rounds)

### Setting Passwords for Existing Users

```bash
npm run password:set user@example.com newpassword123
```

### Test User Passwords

After seeding:

```bash
npm run db:seed
npm run password:set coach@test.local coach123
npm run password:set client@test.local client123
```

---

## How It Works

### Key Files

| File | Purpose |
|------|---------|
| `lib/auth.ts` | Server-side auth config (Better Auth instance, hooks, plugins) |
| `lib/auth-client.ts` | Client-side auth hooks (`useSession`, `signIn`, `signOut`) |
| `app/api/auth/[...all]/route.ts` | Auth API route handler |
| `proxy.ts` | Route protection (cookie-based session check) |
| `components/SessionProvider.tsx` | ErrorBoundary wrapper (no auth provider needed) |

### Server-Side Usage

```typescript
import { getSession } from "@/lib/auth"

// In API routes or server components
const session = await getSession()
if (!session?.user?.id) {
  // Not authenticated
}

// Session shape:
// {
//   user: {
//     id: string
//     email: string
//     name: string | null
//     image: string | null
//     roles: Role[]          // ["CLIENT"], ["COACH"], ["ADMIN"], etc.
//     isTestUser: boolean
//     mustChangePassword: boolean
//     onboardingComplete: boolean
//   }
// }
```

### Client-Side Usage

```typescript
"use client"
import { useSession, signIn, signOut } from "@/lib/auth-client"

function MyComponent() {
  const { data: session, status } = useSession()
  // status: "loading" | "authenticated" | "unauthenticated"

  // Sign in with Google
  await signIn("google", { callbackUrl: "/dashboard" })

  // Sign in with email/password
  await signIn("credentials", {
    email: "user@example.com",
    password: "password123",
    callbackUrl: "/dashboard",
    redirect: false,  // Returns result instead of redirecting
  })

  // Sign out
  await signOut({ callbackUrl: "/login" })
}
```

---

## Session & Cookies

Better Auth uses database-backed sessions with cookies:

- **Cookie name**: `better-auth.session_token` (or `__Secure-better-auth.session_token` on HTTPS)
- **Session duration**: 1 hour
- **Refresh interval**: Every 5 minutes
- **Cookie cache**: 5 minutes (reduces DB queries)

The `proxy.ts` middleware checks for the session cookie on protected routes and redirects unauthenticated users to `/login`.

---

## Account Linking

When a user signs up with email/password and later signs in with Google (or vice versa) using the same email address, Better Auth automatically links both accounts. This is configured via:

```typescript
account: {
  accountLinking: {
    enabled: true,
    trustedProviders: ["google"],
  },
},
```

Only providers listed in `trustedProviders` are auto-linked. This prevents untrusted OAuth providers from hijacking accounts.

---

## Hooks (Post-Auth Events)

Better Auth hooks run after authentication events:

### After Sign-In (`/sign-in/social` or `/sign-in/email`)
- Processes pending coach invites (sets `invitedByCoachId` on User)
- Processes pending cohort invites (creates `CohortMembership`)

### After Sign-Up (`/sign-up/email` or `/sign-in/social` for new users)
- Sets default `CLIENT` role if user has no roles
- Sends welcome email (fire-and-forget, suppressed for test users)

---

## Custom Session Data

The `customSession` plugin enriches every session with data from the database:

- `roles` — User's role array from the `User` table
- `isTestUser` — Whether this is a test account
- `mustChangePassword` — Whether the user needs to change their password
- `onboardingComplete` — Whether onboarding is finished
- Admin override check — Grants `ADMIN` role if `ADMIN_OVERRIDE_EMAIL` matches

---

## Production Deployment

### Required Steps

1. **Set environment variables** on your hosting provider:
   ```
   BETTER_AUTH_URL=https://your-domain.com
   BETTER_AUTH_SECRET=<generated-secret>
   GOOGLE_CLIENT_ID=<your-client-id>
   GOOGLE_CLIENT_SECRET=<your-client-secret>
   DATABASE_URL=<your-postgres-url>
   ```

2. **Run database migration**:
   ```bash
   npx prisma migrate deploy
   ```

3. **Update Google OAuth redirect URI** in Google Cloud Console:
   ```
   https://your-domain.com/api/auth/callback/google
   ```

4. **Create first admin**:
   ```bash
   npm run admin:set your-email@example.com
   ```

### Migrating from NextAuth

If upgrading an existing deployment:

1. The database migration (`20260314200000_migrate_to_better_auth`) handles schema changes automatically
2. Existing `NEXTAUTH_URL` / `NEXTAUTH_SECRET` env vars still work as fallbacks
3. Users will need to sign in again (new session format)
4. Existing password hashes are compatible (both use bcrypt)
5. Google OAuth callback URL path is unchanged (`/api/auth/callback/google`)

---

## Troubleshooting

### Google OAuth: "redirect_uri_mismatch"

The redirect URI in Google Cloud Console doesn't match your app URL. Ensure:
- `http://localhost:3000/api/auth/callback/google` for local dev
- `https://your-domain.com/api/auth/callback/google` for production
- No trailing slash
- Protocol matches exactly (http vs https)

### Session Not Persisting

1. Check `BETTER_AUTH_URL` matches the URL you're accessing (including port)
2. Verify `BETTER_AUTH_SECRET` is set
3. Check browser cookies — look for `better-auth.session_token`
4. Check database — `Session` table should have active sessions

### "Unauthorized" on API Routes

1. Verify the session cookie is being sent with requests
2. Check that `getSession()` is imported from `@/lib/auth` (not from Better Auth directly)
3. Look at server logs for `[AUTH] Error getting session` messages

### Account Linking Not Working

1. Ensure the email addresses match exactly (case-insensitive)
2. Check that `google` is in the `trustedProviders` array
3. Verify the user has an existing account with that email

---

**Last Updated**: March 2026
