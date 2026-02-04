# Notification System Setup Guide

This guide walks you through setting up the CoachFit notification system for both Web Push notifications and Email notifications.

## Table of Contents

1. [Overview](#overview)
2. [Step 1: Generate VAPID Keys](#step-1-generate-vapid-keys)
3. [Step 2: Configure Environment Variables](#step-2-configure-environment-variables)
4. [Step 3: Run Database Migration](#step-3-run-database-migration)
5. [Step 4: Setup Email Templates (Optional)](#step-4-setup-email-templates-optional)
6. [Step 5: Configure Vercel Cron Jobs](#step-5-configure-vercel-cron-jobs)
7. [Testing Notifications](#testing-notifications)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The notification system supports:

| Notification Type | When Sent | Channels |
|-------------------|-----------|----------|
| Daily Check-in Reminder | User's preferred time (8 AM, 2 PM, or 6 PM) | Push + Email |
| Weekly Questionnaire | Sunday at 9 AM | Push + Email |
| Missed Entry Reminder | Daily at 10 AM (if user missed logging) | Push + Email |
| Missed Questionnaire | Tuesday & Thursday at 10 AM | Push + Email |
| Coach Note | Immediately when coach creates a note | Push + Email |

Users can configure their preferences at `/client-dashboard/settings`.

---

## Step 1: Generate VAPID Keys

VAPID (Voluntary Application Server Identification) keys are required for Web Push notifications. They authenticate your server to push services (Google, Apple, Mozilla, etc.).

### Option A: Using the Built-in Script (Recommended)

```bash
# From the project root directory
npm run notifications:generate-vapid
```

This will output something like:

```
=== VAPID Keys Generated ===

Add these to your .env.local file:

NEXT_PUBLIC_VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U
VAPID_PRIVATE_KEY=UUxI4O8-FbRouADVXBXFXIvT8rptQQPcGYmBZmNqj9A
VAPID_SUBJECT=mailto:notifications@coachfit.app

============================
```

**Copy these values** - you'll need them in Step 2.

### Option B: Using web-push CLI Directly

If the script doesn't work, you can generate keys manually:

```bash
# Install web-push globally (if not already installed)
npm install -g web-push

# Generate VAPID keys
web-push generate-vapid-keys
```

This outputs:

```
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U

Private Key:
UUxI4O8-FbRouADVXBXFXIvT8rptQQPcGYmBZmNqj9A

=======================================
```

### Option C: Using Node.js REPL

```bash
node -e "const webpush = require('web-push'); const keys = webpush.generateVAPIDKeys(); console.log('Public:', keys.publicKey); console.log('Private:', keys.privateKey);"
```

---

## Step 2: Configure Environment Variables

Add the following to your environment variables:

### Local Development (.env.local)

Create or edit `.env.local` in your project root:

```bash
# Web Push Notifications (VAPID)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key_from_step_1
VAPID_PRIVATE_KEY=your_private_key_from_step_1
VAPID_SUBJECT=mailto:your-email@example.com

# Cron Job Authentication
CRON_SECRET=generate_a_random_string_here
```

**To generate a CRON_SECRET:**

```bash
# Option 1: Using openssl
openssl rand -base64 32

# Option 2: Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Production (Vercel Dashboard)

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each variable:

| Variable | Value | Environment |
|----------|-------|-------------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Your public key | Production, Preview, Development |
| `VAPID_PRIVATE_KEY` | Your private key | Production, Preview, Development |
| `VAPID_SUBJECT` | `mailto:notifications@yourdomain.com` | Production, Preview, Development |
| `CRON_SECRET` | Your generated secret | Production |

**Important:**
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` must start with `NEXT_PUBLIC_` to be available in the browser
- `VAPID_PRIVATE_KEY` should NOT have `NEXT_PUBLIC_` prefix (it's server-side only)
- Update `VAPID_SUBJECT` with your actual email address

---

## Step 3: Run Database Migration

The notification system adds three new database tables:
- `PushSubscription` - Stores user push notification subscriptions
- `NotificationLog` - Tracks all sent notifications
- `UserPreference` - Extended with notification settings

### Local Development

```bash
# Push schema changes to your local database
npm run db:push
```

### Production (Vercel)

The migration runs automatically during deployment via the `buildCommand` in `vercel.json`:

```json
{
  "buildCommand": "prisma generate && prisma migrate deploy && next build"
}
```

If you need to run it manually:

```bash
npm run db:migrate
```

---

## Step 4: Setup Email Templates (Optional)

Email templates provide professional, branded notification emails. If not set up, the system uses built-in fallback templates.

### Create Templates in Resend

```bash
npm run notifications:setup-templates
```

This creates four email templates in your Resend account:
- `daily-checkin-reminder`
- `missed-entry-reminder`
- `missed-questionnaire-reminder`
- `coach-note-notification`

**Prerequisites:**
- `RESEND_API_KEY` must be configured in your environment
- You need a Resend account at https://resend.com

### Customizing Templates

After running the script, you can customize templates in the Resend dashboard:

1. Go to https://resend.com/templates
2. Click on any template to edit
3. Modify the HTML/design as needed
4. Save and publish changes

---

## Step 5: Configure Vercel Cron Jobs

The `vercel.json` file is already configured with cron jobs. No additional setup needed.

### Cron Schedule

| Endpoint | Schedule | Description |
|----------|----------|-------------|
| `/api/cron/daily-reminders` | `0 6,8,14,18 * * *` | Runs at 6 AM, 8 AM, 2 PM, 6 PM UTC |
| `/api/cron/weekly-questionnaire` | `0 9 * * 0` | Sundays at 9 AM UTC |
| `/api/cron/missed-entries` | `0 10 * * *` | Daily at 10 AM UTC |
| `/api/cron/missed-questionnaires` | `0 10 * * 2,4` | Tuesday & Thursday at 10 AM UTC |

### Vercel Cron Pricing

- **Hobby Plan:** 2 cron jobs, once per day max
- **Pro Plan:** Unlimited cron jobs, up to every minute

If on Hobby plan, you may need to consolidate cron jobs or use an external service like:
- [Cron-job.org](https://cron-job.org) (free)
- [EasyCron](https://www.easycron.com) (free tier available)
- GitHub Actions scheduled workflows

### External Cron Setup (if needed)

If using an external cron service, call the endpoints with the `CRON_SECRET`:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/daily-reminders
```

---

## Testing Notifications

### Test Push Notifications Locally

1. Start the dev server: `npm run dev`
2. Open the app in Chrome/Edge/Firefox
3. Go to `/client-dashboard/settings`
4. Click "Enable" under Push Notifications
5. Allow notifications when prompted
6. You can test by calling the API directly:

```bash
# Test daily reminder for a specific user
curl -X GET "http://localhost:3000/api/cron/daily-reminders" \
  -H "Authorization: Bearer your_cron_secret"
```

### Test Email Notifications

Emails are sent via Resend. Check:
1. Your Resend dashboard for sent emails
2. The recipient's inbox (and spam folder)
3. Console logs for test users (emails are logged, not sent)

### Verify Cron Jobs on Vercel

1. Go to Vercel Dashboard → Your Project → **Deployments**
2. Click on the latest deployment
3. Go to **Functions** tab
4. Look for cron function invocations

---

## Troubleshooting

### Push Notifications Not Working

**Browser shows "Blocked":**
- User denied permission. They need to:
  1. Click the lock icon in the browser address bar
  2. Find "Notifications" setting
  3. Change from "Block" to "Allow"
  4. Refresh the page

**Notifications not appearing:**
- Check browser notification settings (system-level)
- On macOS: System Preferences → Notifications → Browser
- On Windows: Settings → System → Notifications
- On iOS: Push only works when PWA is installed to home screen (iOS 16.4+)

**VAPID key errors in console:**
- Verify `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is set correctly
- Make sure it starts with `NEXT_PUBLIC_`
- Check that the key wasn't truncated when copying

### Email Notifications Not Sending

**Check Resend configuration:**
```bash
npm run email:verify
```

**Common issues:**
- `RESEND_API_KEY` not set or invalid
- Sender domain not verified in Resend
- User has `isTestUser: true` (emails are logged, not sent)

### Cron Jobs Not Running

**Verify CRON_SECRET:**
- Must match between environment variables and the calling service
- Check Vercel logs for 401 errors

**Check Vercel cron limits:**
- Hobby plan: 2 jobs, daily frequency max
- Verify cron syntax in `vercel.json`

### Database Errors

**Migration issues:**
```bash
# Reset and regenerate Prisma client
npm run db:generate

# Push schema changes (development)
npm run db:push

# Deploy migrations (production)
npm run db:migrate
```

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Yes | Public VAPID key (exposed to browser) |
| `VAPID_PRIVATE_KEY` | Yes | Private VAPID key (server-only) |
| `VAPID_SUBJECT` | Yes | Contact email for push services |
| `CRON_SECRET` | Yes (prod) | Authenticates cron job requests |
| `RESEND_API_KEY` | Optional | For email notifications |
| `NEXTAUTH_URL` | Yes | Base URL for links in notifications |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Browser                           │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │  Settings Page  │    │  Service Worker │                    │
│  │  (Preferences)  │    │  (Push Handler) │                    │
│  └────────┬────────┘    └────────▲────────┘                    │
└───────────┼──────────────────────┼──────────────────────────────┘
            │                      │
            ▼                      │ Push
┌───────────────────────┐         │
│    API Endpoints      │         │
│  /api/notifications/* │         │
└───────────┬───────────┘         │
            │                      │
            ▼                      │
┌───────────────────────┐         │
│  Notification Service │─────────┘
│  (lib/notifications)  │
└───────────┬───────────┘
            │
            ├──────────────────────┐
            ▼                      ▼
┌───────────────────┐    ┌───────────────────┐
│   Push Service    │    │   Resend Email    │
│   (web-push)      │    │   Service         │
└───────────────────┘    └───────────────────┘
            │                      │
            ▼                      ▼
┌───────────────────┐    ┌───────────────────┐
│  Browser Push API │    │  User's Inbox     │
│  (FCM, APNs, etc) │    │                   │
└───────────────────┘    └───────────────────┘
```

---

## Support

If you encounter issues not covered here:

1. Check the browser console for JavaScript errors
2. Check Vercel function logs for server-side errors
3. Review the Resend dashboard for email delivery issues
4. Ensure all environment variables are correctly set
