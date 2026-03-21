# Authentication Setup Guide

CoachFit uses [Clerk](https://clerk.com) for managed authentication, supporting Google OAuth and email/password login.

---

## Overview

- **Service**: Clerk (managed auth — no self-hosted auth infrastructure)
- **Providers**: Google OAuth, Email/Password (configured in Clerk Dashboard)
- **Session management**: Handled entirely by Clerk (cookie-based)
- **User data**: Synced from Clerk to local PostgreSQL via webhooks
- **Free tier**: 10,000 monthly active users

---

## Setup (3 Steps)

### 1. Create Clerk Account

1. Go to [clerk.com](https://clerk.com) and sign up
2. Create a new application, name it "CoachFit"
3. Under **Social Connections**, enable **Google** (Clerk manages the OAuth credentials — no Google Cloud Console needed)
4. Under **Authentication**, enable **Email/Password**

### 2. Set Environment Variables

Copy your API keys from the Clerk Dashboard (**API Keys** page) into `.env.local`:

```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
```

That's it. No `GOOGLE_CLIENT_ID`, no `AUTH_SECRET`, no database session tables.

### 3. Set Up Webhook (For User Sync)

1. In Clerk Dashboard, go to **Webhooks** → **Add Endpoint**
2. Set the URL to `https://your-domain.com/api/webhooks`
3. Subscribe to events: `user.created`, `user.updated`
4. Copy the **Signing Secret** and add to `.env.local`:

```env
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
```

For local development, use [ngrok](https://ngrok.com) or skip webhooks (users are auto-created on first API call).

---

## How It Works

### Architecture

```
Clerk (managed service)          Your Database (PostgreSQL)
┌──────────────────────┐         ┌──────────────────────┐
│ Users & Sessions     │         │ User table           │
│ Google OAuth         │  sync   │  - id (UUID)         │
│ Email/Password       │ ──────→ │  - clerkId           │
│ Password hashing     │ webhook │  - email             │
│ Session cookies      │         │  - roles[]           │
└──────────────────────┘         │  - isTestUser        │
                                 │  - onboardingComplete│
                                 └──────────────────────┘
```

- **Clerk** manages authentication (sign-in, sign-up, sessions, OAuth)
- **Your database** stores business data (roles, cohorts, entries, etc.)
- **Webhooks** sync new users from Clerk to your database
- **`getSession()`** looks up the Clerk user, then enriches with database data (roles, etc.)

### Key Files

| File | Purpose |
|------|---------|
| `lib/auth.ts` | Server-side: `getSession()` — returns enriched session from Clerk + DB |
| `lib/auth-client.ts` | Client-side: `useSession()`, `signIn()`, `signOut()` wrappers |
| `app/api/webhooks/route.ts` | Clerk webhook handler — syncs users, processes invites |
| `proxy.ts` | Clerk middleware + security headers + CORS |
| `app/layout.tsx` | `<ClerkProvider>` wrapper |
| `app/login/page.tsx` | Clerk `<SignIn />` component |
| `app/signup/page.tsx` | Clerk `<SignUp />` component |

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
//     id: string          // Local DB user ID (UUID)
//     email: string
//     name: string | null
//     image: string | null
//     roles: Role[]       // ["CLIENT"], ["COACH"], ["ADMIN"], etc.
//     isTestUser: boolean
//     mustChangePassword: boolean
//     onboardingComplete: boolean
//   }
// }
```

### Client-Side Usage

```typescript
"use client"
import { useSession } from "@/lib/auth-client"

function MyComponent() {
  const { data: session, status } = useSession()
  // status: "loading" | "authenticated" | "unauthenticated"
  // session.user.roles, session.user.id, etc.
}
```

For sign-out in components:
```typescript
import { useSignOut } from "@/lib/auth-client"

function LogoutButton() {
  const signOut = useSignOut()
  return <button onClick={() => signOut({ callbackUrl: "/login" })}>Sign out</button>
}
```

---

## Platform Invite Gate

CoachFit uses an **invite-only** signup model. Only users whose email has been invited (via a `PlatformInvite`, `CoachInvite`, or `CohortInvite`) can create an account.

### How It Works

1. An admin or coach creates a **Platform Invite** for an email at `/admin/invites` (or via `POST /api/admin/platform-invites`)
2. The user receives an invite email and signs up via Clerk (Google, email/password, etc.)
3. The webhook handler checks for a pending invite before creating the local User record
4. If **no invite exists**: the Clerk user is deleted and no local account is created — the user is effectively rejected
5. If an invite exists: the account is created normally and the `PlatformInvite` is marked as used

### Invite Types That Grant Access

| Invite Type | Created By | Purpose |
|---|---|---|
| `PlatformInvite` | Admin or Coach | General platform access (no coach link) |
| `CoachInvite` | Coach | Platform access + coach-client link |
| `CohortInvite` | Coach | Platform access + cohort membership |

Any of these invites is sufficient to allow signup. Platform invites are the simplest — they just grant access without linking to a coach or cohort.

### Admin UI

Admins and coaches can manage platform invites at `/admin/invites`:
- Send new invites by email
- View pending and used invites
- Revoke pending invites

---

## User Sync Flow

When a user signs up via Clerk:

1. Clerk creates the user and fires a `user.created` webhook
2. Our webhook handler (`app/api/webhooks/route.ts`):
   - **Checks for a pending invite** (`PlatformInvite`, `CoachInvite`, or `CohortInvite`)
   - If no invite exists: deletes the Clerk user and returns (signup rejected)
   - If invite exists: marks `PlatformInvite` as used (if applicable)
   - Creates a local `User` record with `clerkId`
   - Sets default `CLIENT` role
   - Processes pending coach/cohort invites
   - Syncs roles to Clerk's `publicMetadata` (so client-side can read them)
   - Sends welcome email via Resend

If the webhook hasn't fired yet when the user makes their first API call, `getSession()` auto-creates the local user record.

---

## Roles & Permissions

Roles are stored in our database (`User.roles[]`), NOT in Clerk. Clerk's `publicMetadata` holds a copy for client-side access, but the DB is the source of truth.

When roles change (via admin panel), update both:
```typescript
// Update DB
await db.user.update({ where: { id }, data: { roles: newRoles } })

// Sync to Clerk metadata
const client = await clerkClient()
await client.users.updateUserMetadata(clerkId, {
  publicMetadata: { roles: newRoles }
})
```

---

## Production Deployment

### Required Steps

1. **Set environment variables** on your hosting provider:
   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
   NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
   NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup
   DATABASE_URL=<your-postgres-url>
   ```

2. **Run database migration**:
   ```bash
   npx prisma migrate deploy
   ```

3. **Configure Clerk webhook**:
   - Add production webhook URL in Clerk Dashboard
   - Subscribe to `user.created` and `user.updated` events

4. **Create first admin**:
   ```bash
   npm run admin:set your-email@example.com
   ```

---

## Troubleshooting

### "Unauthorized" on API Routes

1. Verify Clerk env vars are set (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)
2. Check that `getSession()` is imported from `@/lib/auth`
3. If user exists in Clerk but gets null session, check that the webhook created the local DB user

### User Signed Up but No Roles

The webhook may not have fired. Check:
1. Webhook endpoint is configured in Clerk Dashboard
2. `CLERK_WEBHOOK_SIGNING_SECRET` is correct
3. Webhook URL is accessible from the internet (use ngrok for local dev)

If the webhook didn't fire, `getSession()` auto-creates the user with `CLIENT` role on first API call.

### Google Sign-In Not Working

Google OAuth is configured entirely in Clerk Dashboard → Social Connections. No Google Cloud Console credentials needed. If it's not working:
1. Check that Google is enabled in Clerk Dashboard
2. Verify your Clerk application is in production mode (not development) for production domains

---

**Last Updated**: March 2026
