# Database Setup for Vercel Deployment

When deploying to Vercel, you need to make a few important changes to ensure your database works correctly with Vercel's serverless architecture.

## Key Changes Required

### 1. **Connection Pooling (CRITICAL)**

Vercel uses **serverless functions**, which means each API route or Server Component can create a new database connection. Without connection pooling, you'll quickly exhaust your database connection limit.

**Railway PostgreSQL Connection Limits:**
- Free tier: ~100 connections
- Paid tiers: Varies by plan

**Solution: Use a Connection Pooler**

#### Option A: Railway Connection Pooler (Recommended)

Railway provides a connection pooler URL. Use this instead of the direct connection string:

1. In Railway dashboard, go to your PostgreSQL service
2. Look for **"Connection Pooler"** or **"Pooler URL"** in the Variables tab
3. Use the pooler URL (usually looks like: `postgresql://...@...railway.app:PORT/railway?pgbouncer=true`)
4. Or add `?pgbouncer=true` to your existing connection string

**Update your `DATABASE_URL` in Vercel:**
```
# Instead of:
postgresql://user:pass@host:port/db?sslmode=require

# Use (if Railway provides pooler):
postgresql://user:pass@host:port/db?sslmode=require&pgbouncer=true
```

#### Option B: Prisma Data Proxy (Alternative)

If Railway doesn't provide a pooler, consider using Prisma Data Proxy:
1. Sign up at [Prisma Data Platform](https://www.prisma.io/data-platform)
2. Create a proxy for your database
3. Use the proxy connection string in Vercel

#### Option C: External Connection Pooler (Advanced)

Use PgBouncer or similar:
- Set up a connection pooler service
- Point your `DATABASE_URL` to the pooler instead of direct database

### 2. **Environment Variables in Vercel**

**Required:**
- `DATABASE_URL` - Your Railway PostgreSQL connection string (with pooler if available)

**Steps:**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add `DATABASE_URL` with your Railway connection string
3. Set for **Production**, **Preview**, and **Development** environments
4. Make sure it includes `?sslmode=require` for Railway

### 3. **Database Migrations**

Run migrations **before** your first deployment or as part of your deployment:

#### Option A: Run Migrations Locally (Before Deploy)
```bash
# Set DATABASE_URL to your production database
export DATABASE_URL="your-production-connection-string"
npm run db:migrate
```

#### Option B: Use Railway CLI
```bash
railway run npm run db:migrate
```

#### Option C: Add to Vercel Build Command (Not Recommended)
You can add migrations to your build, but this is slower and can cause issues:
```json
// package.json
{
  "scripts": {
    "vercel-build": "prisma migrate deploy && next build"
  }
}
```

**Recommended:** Run migrations manually before deploying, or use a CI/CD pipeline.

### 4. **Prisma Client Generation**

Prisma Client is automatically generated during `next build` on Vercel, but ensure:

1. `prisma` is in your `package.json` dependencies (not devDependencies)
2. `@prisma/client` is in dependencies
3. Your `schema.prisma` is committed to git

### 5. **Connection String Format**

Your `DATABASE_URL` should look like:
```
postgresql://user:password@host:port/database?sslmode=require
```

For Railway with connection pooling:
```
postgresql://user:password@host:port/database?sslmode=require&pgbouncer=true
```

### 6. **Verify Database Access**

Ensure your Railway database:
- ✅ Is publicly accessible (Railway databases are by default)
- ✅ Has SSL enabled (Railway requires this)
- ✅ Has connection pooling enabled (if available)

## Testing Your Setup

1. **Deploy to Vercel**
2. **Check Vercel Logs** for database connection errors
3. **Test a simple query** (e.g., login) to verify connection works
4. **Monitor Railway Dashboard** for connection count

## Common Issues

### "Too many connections" Error

**Cause:** Serverless functions creating too many connections without pooling.

**Solution:**
- Enable connection pooling (see Option A above)
- Reduce connection timeout in Prisma config
- Use connection pooler URL

### "Connection timeout" Error

**Cause:** Database not accessible or SSL issues.

**Solution:**
- Verify `DATABASE_URL` is correct
- Ensure `?sslmode=require` is in connection string
- Check Railway database is running

### "Migration not found" Error

**Cause:** Migrations not run in production.

**Solution:**
- Run `npm run db:migrate` with production `DATABASE_URL`
- Or use Railway CLI: `railway run npm run db:migrate`

## Recommended Setup Summary

1. ✅ Use Railway connection pooler URL (if available)
2. ✅ Set `DATABASE_URL` in Vercel environment variables
3. ✅ Run migrations manually before first deploy
4. ✅ Use the `lib/db.ts` singleton pattern (already created)
5. ✅ Monitor connection count in Railway dashboard

## Next Steps

1. Check Railway dashboard for connection pooler option
2. Update `DATABASE_URL` in Vercel with pooler URL
3. Run migrations: `railway run npm run db:migrate`
4. Deploy to Vercel
5. Test and monitor
