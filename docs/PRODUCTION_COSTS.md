# CoachFit Production Costs

This document outlines all external services and their associated costs for running CoachFit in production.

---

## Required Services (Must Pay)

| Service | What For | Free Tier | Production Cost |
|---------|----------|-----------|-----------------|
| **Railway PostgreSQL** | Database | Limited | $5-50/month |
| **Vercel** | Hosting | Limited | $20+/month |
| **Resend** | Transactional email | Limited | $20-100+/month |
| **Clerk** | Authentication (Google OAuth, Email/Password) | 10K MAU free | Free–$25+/month |

**Minimum monthly cost: ~$45-120+**

---

## Service Details

### 1. Database - Railway PostgreSQL
- **Purpose**: Primary data store for all application data (users, entries, cohorts, etc.)
- **Configuration**: `DATABASE_URL` environment variable
- **Free Tier**: Yes - limited resources
- **Production Cost**: $5-50/month depending on usage
- **Documentation**: [Railway Pricing](https://railway.app/pricing)

### 2. Hosting - Vercel
- **Purpose**: Frontend, API routes, and middleware hosting
- **Free Tier**: Yes - generous but limited
- **Production Cost**: $20+/month (Pro plan)
- **Includes**:
  - Automatic deployments from GitHub
  - Built-in CDN
  - Speed Insights analytics
  - Automatic HTTPS
  - Edge Functions
- **Documentation**: [Vercel Pricing](https://vercel.com/pricing)

### 3. Email - Resend
- **Purpose**: Transactional emails (welcome emails, invitations, questionnaire notifications)
- **Configuration**: `RESEND_API_KEY` environment variable
- **Free Tier**: Yes - limited monthly emails
- **Production Cost**: $20-100+/month depending on email volume
- **Note**: Using custom domain (`@gcgyms.com`) for production email sending.
- **Documentation**: [Resend Pricing](https://resend.com/pricing)

### 4. Authentication - Clerk
- **Purpose**: Managed authentication (Google OAuth, Email/Password)
- **Configuration**: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`
- **Free Tier**: 10,000 monthly active users
- **Production Cost**: Free for most small apps; $25+/month for higher tiers
- **Note**: Google OAuth is configured in Clerk Dashboard — no Google Cloud Console needed
- **Documentation**: [Clerk Pricing](https://clerk.com/pricing)

---

## Optional Services

| Service | What For | Cost |
|---------|----------|------|
| **Apple Sign-In** | iOS login option | $99/year |
| **SurveyJS License** | Advanced questionnaire features | $500-2000+/year |

### Apple Sign-In (Optional, Future)
- **Purpose**: Alternative authentication for iOS users
- **Configuration**: Enable in Clerk Dashboard → Social Connections → Apple
- **Cost**: $99/year (Apple Developer Program membership)
- **Note**: Not currently enabled; can be added via Clerk Dashboard

### SurveyJS Commercial License (Optional)
- **Purpose**: Advanced questionnaire builder features
- **Configuration**: `NEXT_PUBLIC_SURVEYJS_LICENSE`
- **Cost**: $500-2000+/year depending on features
- **Note**: Free/open-source version works for basic functionality

---

## What's NOT Currently Included

The following services are NOT integrated and have no current cost:

| Category | Status |
|----------|--------|
| **Payment Processor** (Stripe, etc.) | Not integrated |
| **File Storage** (S3, R2) | Not integrated |
| **SMS Service** (Twilio) | Not integrated |
| **Error Monitoring** (Sentry, Datadog) | Not integrated |
| **Third-party Analytics** (Mixpanel, Segment) | Not integrated |

---

## Cost Summary

### Minimum Production Budget

| Tier | Monthly Cost | Annual Cost |
|------|--------------|-------------|
| **Essential Only** | $45-70 | $540-840 |
| **With Higher Usage** | $100-150 | $1,200-1,800 |
| **With All Optional** | $200-300+ | $2,400-3,600+ |

### Recommended Starting Budget

For a small-scale production launch:
- **Monthly**: ~$75-100
- **Annual**: ~$900-1,200

---

## Environment Variables Required

```env
# Database (Required)
DATABASE_URL=postgresql://...

# Authentication - Clerk (Required)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup

# Clerk Webhook (Recommended)
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...

# Email (Required)
RESEND_API_KEY=...

# SurveyJS (Optional)
NEXT_PUBLIC_SURVEYJS_LICENSE=...
```

---

## Notes

1. **Test Users**: Test users don't consume email quota - emails are logged to console instead
2. **Graceful Degradation**: Email service won't block user flows if API key is missing
3. **Vercel CDN**: Included with Vercel hosting at no extra cost
4. **Speed Insights**: Included free with Vercel

---

*Last updated: March 2026*
