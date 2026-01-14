# Deployment Guide for Vercel

## Prerequisites
- Vercel account
- PostgreSQL database (e.g., Neon, Supabase, or Vercel Postgres)

## Environment Variables

Set these in your Vercel project settings:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database?schema=public"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32
NEXTAUTH_URL="https://your-app.vercel.app"

# Email (Resend)
RESEND_API_KEY="your-resend-api-key"
RESEND_FROM_EMAIL="noreply@yourdomain.com"
```

## Deployment Steps

### 1. Push to GitHub
```bash
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

### 2. Connect to Vercel
- Go to vercel.com and import your GitHub repository
- Configure environment variables
- Deploy

### 3. Run Database Migrations
After first deployment, run migrations from your local machine:

```bash
# Set DATABASE_URL to your production database
export DATABASE_URL="your-production-database-url"

# Run migrations
npm run db:migrate
```

### 4. Seed Test Users (Optional)
For production testing, seed test users:

```bash
# Ensure DATABASE_URL points to production
npm run db:seed
```

This creates:
- `admin@test.local` (ADMIN)
- `coach@test.local` (COACH)
- `client@test.local` (CLIENT)
- `noinvite@test.local` (CLIENT, no cohort)
- `unassigned@test.local` (CLIENT, pending invite)

### 5. Set Passwords for Test Users
```bash
npm run password:set admin@test.local YourPassword123
npm run password:set coach@test.local YourPassword123
npm run password:set client@test.local YourPassword123
```

## Post-Deployment

1. **Test the application**
   - Try logging in with test users
   - Test all major features
   - Check admin, coach, and client dashboards

2. **Monitor for errors**
   - Check Vercel logs
   - Monitor database connections

3. **Security checklist**
   - ✅ NEXTAUTH_SECRET is unique and secure
   - ✅ DATABASE_URL uses SSL connection
   - ✅ All environment variables are set
   - ✅ Test users have strong passwords in production

## Troubleshooting

### Issue: Redirect loops on login
- Clear browser cookies
- Verify NEXTAUTH_URL matches your deployed domain
- Check that onboardingComplete is true for test users

### Issue: Database connection errors
- Verify DATABASE_URL is correct
- Ensure database allows connections from Vercel IPs
- Check SSL mode in connection string

### Issue: Email not sending
- Verify RESEND_API_KEY is valid
- Check RESEND_FROM_EMAIL domain is verified
- Look at Vercel function logs for email errors

## Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Database
npm run db:generate      # Generate Prisma client
npm run db:push          # Push schema changes
npm run db:migrate       # Run migrations
npm run db:studio        # Open Prisma Studio
npm run db:seed          # Seed test users

# Admin
npm run admin:set        # Set admin role on user
npm run password:set     # Set user password

# Testing
npm run test:generate    # Generate test data
npm run test:cleanup     # Cleanup test data
```
