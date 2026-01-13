# Deployment Guide

Complete guide for deploying CoachFit to production.

---

## Table of Contents

1. [Overview](#overview)
2. [Vercel Deployment](#vercel-deployment)
3. [Database Setup (Railway)](#database-setup-railway)
4. [Environment Variables](#environment-variables)
5. [OAuth Configuration](#oauth-configuration)
6. [Post-Deployment](#post-deployment)

---

## Overview

### Deployment Stack

- **Hosting**: Vercel (automatic deployments from GitHub)
- **Database**: Railway PostgreSQL
- **Email**: Resend (transactional emails)
- **Auth**: NextAuth.js with Google OAuth (+ optional Apple Sign-In)

### Deployment Checklist

- [ ] PostgreSQL database on Railway
- [ ] Environment variables configured in Vercel
- [ ] Google OAuth redirect URIs updated
- [ ] Database migrations run
- [ ] Test deployment verified

---

## Vercel Deployment

### 1. Push to GitHub

```bash
git push origin main
```

### 2. Import Project in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "Import Project"
3. Select your GitHub repository (`adamswbrown/CoachFit`)
4. Click "Import"
5. Vercel will automatically detect Next.js

### 3. Configure Build Settings

Vercel auto-detects Next.js settings:

- **Framework Preset**: Next.js
- **Root Directory**: `Web/`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

**Important**: Set **Root Directory** to `Web/` since the Next.js app is in a subfolder.

### 4. Deploy

Click "Deploy" and Vercel will:
- Install dependencies
- Run build
- Deploy to production
- Generate a URL (e.g., `https://your-app.vercel.app`)

---

## Database Setup (Railway)

### 1. Create PostgreSQL Database

1. Go to [Railway](https://railway.app/)
2. Create a new project
3. Click "+ New" → "Database" → "PostgreSQL"
4. Wait for provisioning (1-2 minutes)

### 2. Get Connection String

1. Click on your PostgreSQL service
2. Go to "Variables" tab
3. Copy the `DATABASE_URL` value
4. It should look like:
   ```
   postgresql://username:password@host:port/database
   ```

### 3. Add to Vercel

1. Go to your project in Vercel Dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add `DATABASE_URL` with the Railway connection string
4. Set for all environments (Production, Preview, Development)

### 4. Run Migrations

**Option A: Local (Recommended)**

```bash
# Set DATABASE_URL to production database
export DATABASE_URL="postgresql://..."

# Run migrations
npm run db:migrate

# Verify
npm run db:studio
```

**Option B: Railway CLI**

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Run migrations
railway run npm run db:migrate
```

---

## Environment Variables

### Required Variables

Configure in Vercel Dashboard (**Settings** → **Environment Variables**):

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require

# NextAuth
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-production-secret  # Generate with: openssl rand -base64 32

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
NEXT_PUBLIC_APPLE_CLIENT_ID=your-apple-client-id
```

### Environment Targeting

For each variable, select environments:
- **Production**: Your main deployment
- **Preview**: PR previews (optional)
- **Development**: Local development (optional)

**Important**: `NEXTAUTH_URL` should be different per environment:
- Production: `https://your-app.vercel.app`
- Preview: `https://[branch]-your-app.vercel.app`
- Development: `http://localhost:3000`

---

## OAuth Configuration

### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Click on your OAuth 2.0 Client ID
5. Add authorized redirect URI:
   ```
   https://your-app.vercel.app/api/auth/callback/google
   ```
6. Save changes

### Apple Sign-In (Optional)

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Navigate to your Service ID configuration
3. Add return URL:
   ```
   https://your-app.vercel.app/api/auth/callback/apple
   ```
4. Save changes

---

## Post-Deployment

### 1. Verify Deployment

Visit your Vercel URL and verify:
- [ ] Site loads correctly
- [ ] Login page is accessible
- [ ] Google OAuth works
- [ ] Can create test account

### 2. Create Admin Account

```bash
# Set DATABASE_URL to production
export DATABASE_URL="postgresql://..."

# Create admin user
npm run admin:set admin@yourdomain.com

# Or manually update in database
```

### 3. Test Critical Paths

- [ ] Sign up with Google OAuth
- [ ] Sign up with email/password
- [ ] Create cohort (as coach)
- [ ] Invite client
- [ ] Submit entry (as client)
- [ ] View analytics (as coach)

### 4. Monitor

Check Vercel logs for errors:
1. Go to Vercel Dashboard
2. Click on your deployment
3. Navigate to "Logs" tab
4. Monitor for errors or warnings

---

## Continuous Deployment

### Automatic Deployments

Vercel automatically deploys when you push to `main`:

```bash
git push origin main
```

### Preview Deployments

Vercel creates preview deployments for all branches and PRs:
- Each PR gets a unique URL
- Perfect for testing before merging
- Automatic cleanup after merge

### Production URL

After first deployment, you can:
1. Use the auto-generated Vercel URL
2. Add a custom domain (Vercel Dashboard → **Settings** → **Domains**)

---

## Rollback Strategy

### Instant Rollback

If a deployment has issues:

1. Go to Vercel Dashboard
2. Click on your project
3. Navigate to "Deployments"
4. Find the previous working deployment
5. Click "..." → "Promote to Production"

**Instant rollback** - takes seconds.

### Database Rollback

For database issues:

1. **Always test migrations locally first**
2. Keep reversible migration scripts
3. For critical issues, restore from Railway backup:
   - Railway automatically backs up databases
   - Go to Railway dashboard → PostgreSQL → "Backups"

---

## Environment-Specific Configuration

### Production vs Preview

**Production** (`main` branch):
- Use production database
- Use production OAuth redirect URIs
- Enable monitoring and alerts

**Preview** (PR branches):
- Can use same production database (careful!)
- Or separate staging database (recommended)
- Use preview-specific OAuth redirect URIs

### Database Strategies

**Option A: Single Database** (Simple)
- Production and preview use same database
- Easier to manage
- Risk: preview changes affect production data

**Option B: Separate Databases** (Recommended)
- Production database for main branch
- Staging database for previews
- Safer but more complex

---

## Monitoring & Maintenance

### Vercel Monitoring

Built-in monitoring:
- **Logs**: Real-time logs in dashboard
- **Analytics**: Page views and performance
- **Speed Insights**: Core Web Vitals
- **Deployments**: Deployment history and status

### Database Monitoring

Railway dashboard provides:
- CPU and memory usage
- Connection count
- Query performance
- Automatic backups

### Error Tracking (Future)

Consider adding:
- **Sentry** - Error tracking and monitoring
- **LogRocket** - Session replay for debugging
- **Datadog** - APM and infrastructure monitoring

---

## Troubleshooting

### Build Fails on Vercel

**Check**:
1. Build works locally (`npm run build`)
2. All dependencies in `package.json`
3. Environment variables set correctly
4. Node version compatible (Vercel uses Node 18+)

**Common Issues**:
- Missing `DATABASE_URL` during build
- TypeScript errors
- Missing dependencies

### Database Connection Issues

**Check**:
1. `DATABASE_URL` is correct
2. Includes `?sslmode=require` for Railway
3. Railway database is running
4. Firewall allows Vercel IPs (Railway allows all by default)

### OAuth Not Working

**Check**:
1. Redirect URIs match exactly (including `https://`)
2. Google OAuth credentials are correct
3. `NEXTAUTH_URL` is set correctly
4. `NEXTAUTH_SECRET` is set

### Environment Variables Not Loading

**Check**:
1. Variables are set in Vercel Dashboard
2. Correct environment selected (Production/Preview/Development)
3. Redeploy after adding variables
4. Variables don't have trailing spaces

---

## Security Considerations

### Production Secrets

- **NEVER commit** `.env.local` or `.env.production`
- Use Vercel environment variables (encrypted at rest)
- Rotate secrets regularly
- Use different secrets for prod vs staging

### Database Security

- Railway databases are private by default
- Use strong passwords
- Enable SSL (`?sslmode=require`)
- Regular backups enabled

### Application Security

- JWT tokens expire after 1 hour
- Passwords hashed with bcrypt (10 rounds)
- Input validation with Zod
- SQL injection protection via Prisma
- XSS protection via React

---

## Scaling Considerations

### Vercel Limits

**Free Tier**:
- 100 GB bandwidth/month
- Unlimited deployments
- Automatic scaling

**Pro Tier** ($20/month):
- 1 TB bandwidth/month
- Team collaboration
- Advanced analytics

### Database Scaling

Railway auto-scales based on usage:
- Starts with 512MB RAM
- Can scale up to 16GB+
- Monitor usage in dashboard

### Future Optimizations

- **CDN**: Vercel Edge Network (included)
- **Caching**: Redis for session caching
- **Background Jobs**: Vercel Cron for scheduled tasks
- **File Storage**: S3/Cloudinary for images

---

## Next Steps

- **[Review Architecture](./architecture.md)**
- **[Read API Reference](./api-reference.md)**
- **[Start Contributing](../../CONTRIBUTING.md)**

---

**Last Updated**: January 2025
