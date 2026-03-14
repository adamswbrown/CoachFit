# Deployment Guide

Complete guide for deploying CoachFit to production.

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Database Setup (Railway)](#database-setup-railway)
4. [Environment Variables](#environment-variables)
5. [Vercel Deployment](#vercel-deployment)
6. [OAuth Configuration](#oauth-configuration)
7. [Post-Deployment](#post-deployment)
8. [Troubleshooting](#troubleshooting)

---

## Overview

CoachFit uses:

- **Vercel** - Frontend and API hosting
- **Railway** - PostgreSQL database hosting
- **Clerk** - Managed authentication (Google OAuth, Email/Password)
- **Resend** - Transactional email service

---

## Prerequisites

Before deploying, ensure you have:

- [x] GitHub repository set up
- [x] Vercel account
- [x] Railway account
- [x] Google OAuth credentials (for Google Sign-In)
- [x] Resend API key (for emails)

---

## Database Setup (Railway)

### 1. Create PostgreSQL Database

1. Go to [Railway.app](https://railway.app)
2. Click "New Project"
3. Select "Provision PostgreSQL"
4. Wait for database to provision
5. Copy the connection string

### 2. Get Connection String

1. Click on your PostgreSQL service
2. Go to "Connect" tab
3. Copy the **DATABASE_URL** (starts with `postgresql://`)

**Format**:
```
postgresql://postgres:PASSWORD@containers-us-west-XXX.railway.app:5432/railway
```

### 3. Configure Connection Pooling (Optional but Recommended)

Railway provides connection pooling via PgBouncer:

1. In Railway, go to your PostgreSQL service
2. Find the "Postgres Connection URL" (with connection pooling)
3. Use this for `DATABASE_URL` in production

**With Pooling**:
```
postgresql://postgres:PASSWORD@roundhouse.proxy.rlwy.net:5432/railway
```

---

## Environment Variables

### Required Variables

Create these environment variables in Vercel:

```bash
# Database
DATABASE_URL="postgresql://postgres:PASSWORD@containers-us-west-XXX.railway.app:5432/railway"

# Clerk Authentication (from dashboard.clerk.com → API Keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_live_..."
CLERK_SECRET_KEY="sk_live_..."
CLERK_WEBHOOK_SIGNING_SECRET="whsec_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/login"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/signup"

# Resend (for emails)
RESEND_API_KEY="re_your_api_key_here"
EMAIL_FROM="CoachFit <noreply@gcgyms.com>"

# Admin Override (optional - emergency admin access)
# ADMIN_OVERRIDE_EMAIL="admin@example.com"
```

### Environment Variable Details

#### DATABASE_URL
- PostgreSQL connection string from Railway
- Includes hostname, port, database name, username, password
- Use connection pooling URL for better performance

#### Clerk Authentication
- Get API keys from [Clerk Dashboard](https://dashboard.clerk.com) → API Keys
- Google OAuth is configured in Clerk Dashboard → Social Connections (no Google Cloud Console needed)
- See [Authentication Setup](./authentication.md) for detailed steps

#### Resend
- Get API key from [Resend Dashboard](https://resend.com/api-keys)
- Verify your sending domain
- FROM_EMAIL must use verified domain

---

## Vercel Deployment

### 1. Connect GitHub Repository

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Add New Project"
3. Import your GitHub repository
4. Select the repository

### 2. Configure Build Settings

Vercel should auto-detect Next.js settings:

- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### 3. Add Environment Variables

1. In Vercel project settings, go to "Environment Variables"
2. Add all required environment variables (see above)
3. Set them for all environments: Production, Preview, Development

### 4. Deploy

1. Click "Deploy"
2. Wait for build to complete
3. Vercel will run:
   - `npm install`
   - `npm run build`
   - Deploy to CDN

### 5. Run Database Migrations

After first deployment, run migrations:

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link project
vercel link

# Run migration
vercel env pull .env.production.local
npx prisma migrate deploy

# IMPORTANT: Seed email templates after migration
npm run db:seed-email-templates
```

Or use Railway CLI:

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Run migration in Railway environment
railway run npx prisma migrate deploy

# IMPORTANT: Seed email templates after migration
railway run npm run db:seed-email-templates
```

**Note**: The email template seeding step is required for the email system to work properly. Skip this and all system emails will use hardcoded fallback content.

### 6. Verify Deployment

1. Visit your Vercel URL
2. Test authentication
3. Check database connection
4. Test OAuth providers

---

## OAuth Configuration

### Authentication Setup (Clerk)

Google OAuth is managed entirely by Clerk — no Google Cloud Console setup needed.

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Enable **Google** under Social Connections
3. Enable **Email/Password** under Authentication
4. Copy API keys to Vercel environment variables
5. Set up webhook endpoint for user sync

See **[Authentication Setup](./authentication.md)** for full details.

---

## Post-Deployment

### 1. Seed Test Data

Create test users for testing:

```bash
# Using Vercel CLI
vercel env pull .env.production.local
npm run db:seed
npm run test:generate
npm run password:set coach@test.local coach123
```

### 2. Create First Admin

Set admin role for your account:

```bash
npm run admin:set your-email@example.com
```

Or manually via Prisma Studio:

```bash
npx prisma studio
# Edit User record, add ADMIN to roles array
```

### 3. Test Core Workflows

- [ ] Sign up with Google OAuth
- [ ] Sign up with Email/Password
- [ ] Create a cohort (as coach)
- [ ] Invite a client
- [ ] Submit a check-in (as client)
- [ ] View analytics (as coach)
- [ ] Test admin features

### 4. Seed Email Templates

**IMPORTANT**: After deploying and running database migrations, you must seed the email templates:

```bash
# Using Vercel CLI in production
vercel env pull .env.production.local
npm run db:seed-email-templates

# Or using Railway CLI
railway run npm run db:seed-email-templates
```

This creates the default email templates in the database:
- Welcome emails (client/coach)
- Invitation emails (coach/cohort)
- Password set/reset emails

**Without this step, all system emails will use hardcoded fallback content.**

To verify templates are seeded:
1. Log in to the admin panel
2. Navigate to **Admin → Email Templates**
3. Confirm all 6 templates are listed

### 5. Configure Email Notifications

Test emails work correctly:

1. Verify Resend domain
2. Test invitation email
3. Check spam folder if not received
4. Configure SPF/DKIM records for better deliverability
5. Customize email templates in Admin → Email Templates (optional)

### 6. Set Up Monitoring

Recommended monitoring tools:

- **Vercel Analytics** - Page views and performance
- **Vercel Logs** - Error tracking and debugging
- **Sentry** (optional) - Error reporting
- **Railway Metrics** - Database performance

---

## Troubleshooting

### Build Failures

**Issue**: Vercel build fails with TypeScript errors

**Solution**:
1. Run `npm run build` locally to catch errors
2. Fix TypeScript errors before deploying
3. Ensure `tsconfig.json` is correct

**Issue**: Prisma client generation fails

**Solution**:
1. Ensure `DATABASE_URL` is set in Vercel environment variables
2. Check Prisma schema for syntax errors
3. Run `npx prisma generate` locally first

### Database Connection Issues

**Issue**: "Can't reach database server" error

**Solution**:
1. Verify `DATABASE_URL` is correct in Vercel
2. Check Railway database is running
3. Ensure Railway allows external connections
4. Test connection locally with same `DATABASE_URL`

**Issue**: Connection pool exhausted

**Solution**:
1. Use Railway's connection pooling URL (PgBouncer)
2. Reduce `connection_limit` in Prisma schema
3. Implement connection pooling in your app
4. Upgrade Railway plan for more connections

### Authentication Issues

**Issue**: Google OAuth fails with "redirect_uri_mismatch"

**Solution**:
1. Check Google Console authorized redirect URIs
2. Ensure they match your Vercel domain exactly
3. Add both production and preview URLs if needed
4. Include `https://` prefix

**Issue**: Session not persisting

**Solution**:
1. Verify `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` are set
2. Ensure Clerk is in the correct mode (development vs production) for your domain
3. Check browser cookies — Clerk manages session cookies automatically
4. See [Authentication Troubleshooting](./authentication.md#troubleshooting) for more details

### Email Issues

**Issue**: Invitation emails not sending

**Solution**:
1. Verify Resend API key is correct
2. Check sending domain is verified in Resend
3. Ensure `EMAIL_FROM` uses verified domain (`@gcgyms.com`)
4. Check Resend dashboard for error logs
5. Verify `TEST_USER_EMAILS` isn't blocking production users

**Issue**: Emails going to spam

**Solution**:
1. Configure SPF record: `v=spf1 include:_spf.resend.com ~all`
2. Configure DKIM in Resend dashboard
3. Use verified domain (not resend.dev)
4. Add proper email headers

### Migration Issues

**Issue**: Migration fails in production

**Solution**:
1. Never run `prisma migrate dev` in production
2. Use `prisma migrate deploy` instead
3. Test migrations in staging first
4. Check Prisma schema for breaking changes

**Issue**: Prisma Client version mismatch

**Solution**:
1. Ensure same Prisma version in package.json
2. Run `npm run db:generate` after schema changes
3. Commit generated client to Git
4. Rebuild Vercel deployment

### Performance Issues

**Issue**: Slow API responses

**Solution**:
1. Use Railway connection pooling
2. Add database indexes for common queries
3. Implement caching (Redis or in-memory)
4. Optimize N+1 queries
5. Use Vercel Edge Functions for static content

**Issue**: Database timeout errors

**Solution**:
1. Increase `connect_timeout` in DATABASE_URL
2. Use connection pooling
3. Optimize slow queries
4. Add appropriate indexes
5. Upgrade Railway plan

---

## Environment-Specific Notes

### Production

- Use connection pooling URL from Railway
- Enable Vercel Analytics
- Set up error monitoring (Sentry)
- Configure custom domain
- Enable Vercel Pro for better performance

### Preview (Staging)

- Use separate Railway database (optional)
- Test migrations before production
- Use test OAuth credentials (optional)
- Preview URLs: `https://your-app-git-branch.vercel.app`

### Development

- Use local PostgreSQL or Railway
- Run migrations with `npm run db:migrate`
- Use `.env.local` for environment variables
- Test OAuth with localhost callbacks

---

## Continuous Deployment

Vercel automatically deploys:

- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and other branches

### Workflow

1. Create feature branch
2. Push changes
3. Vercel creates preview deployment
4. Test preview URL
5. Merge to main
6. Automatic production deployment

### Database Migrations

For breaking changes:

1. Create migration locally: `npm run db:migrate`
2. Test migration in preview environment
3. Merge PR
4. Run migration in production: `railway run npx prisma migrate deploy`
5. Vercel auto-deploys new code

---

## Security Checklist

Before going live:

- [ ] `CLERK_SECRET_KEY` is set (from Clerk Dashboard)
- [ ] All OAuth credentials are production keys
- [ ] `DATABASE_URL` uses SSL connection
- [ ] No secrets committed to Git
- [ ] Resend domain is verified
- [ ] HTTPS enforced (automatic with Vercel)
- [ ] Environment variables set in Vercel (not in code)
- [ ] Test user emails are suppressed in production
- [ ] Admin accounts are secure
- [ ] Role-based access control is working

---

## Helpful Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [Clerk Documentation](https://clerk.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Resend Documentation](https://resend.com/docs)

---

**Last Updated**: March 2026
