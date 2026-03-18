# Email Template System - Deployment Checklist

**CRITICAL**: Follow these steps when deploying the email template system to avoid email delivery issues.

## Quick Deployment Steps

### 1. Deploy Code to Vercel
```bash
# Automatic via GitHub push to main
git push origin main
```

### 2. Run Database Migration
```bash
# Using Vercel CLI
vercel env pull .env.production.local
npx prisma migrate deploy

# OR using Railway CLI
railway run npx prisma migrate deploy
```

### 3. Seed Email Templates (REQUIRED)
```bash
# Using Vercel CLI
npm run db:seed-email-templates

# OR using Railway CLI
railway run npm run db:seed-email-templates
```

### 4. Verify Templates in Admin Panel
1. Log in as admin
2. Go to **Admin → Email Templates**
3. Confirm all 6 templates are present:
   - ✅ Welcome Email - Client
   - ✅ Welcome Email - Coach
   - ✅ Coach Invitation
   - ✅ Cohort Invitation
   - ✅ Password Set (First Time)
   - ✅ Password Reset

### 5. Test Email Sending
Send a test email to verify:
```bash
# Create a test user and invitation
# Emails should use templates, not fallback content
```

---

## What Happens If You Skip Seeding?

**Without running `npm run db:seed-email-templates`:**
- ❌ No templates in database
- ❌ All emails use hardcoded fallback content
- ❌ Admin panel shows empty template list
- ❌ Cannot customize emails without code changes

**With templates seeded:**
- ✅ Templates available in database
- ✅ Emails use configurable content
- ✅ Admin can edit templates via UI
- ✅ Changes take effect immediately

---

## Troubleshooting

### Templates Not Showing in Admin Panel

**Problem**: Admin → Email Templates page is empty

**Solution**:
```bash
# Re-run the seed script
railway run npm run db:seed-email-templates

# Or using Vercel
vercel env pull .env.production.local
npm run db:seed-email-templates
```

### Emails Using Old Content

**Problem**: Emails still show hardcoded text after template edits

**Causes**:
1. Template is disabled (check enabled status)
2. Template seed didn't run
3. Wrong template key used in code

**Solution**:
1. Check template is enabled in admin panel
2. Verify templates exist: `railway run npx prisma studio`
3. Check application logs for errors

### Migration Fails

**Problem**: `prisma migrate deploy` fails

**Solution**:
1. Check database connection: `DATABASE_URL` env var
2. Ensure Railway database is running
3. Check for conflicting migrations
4. Review migration SQL for errors

---

## Re-deploying After Changes

### Template Content Changes
If you only changed template content in the admin UI:
- ✅ No deployment needed
- ✅ Changes are immediate

### Code Changes
If you modified template keys or added new templates:
```bash
# 1. Push code changes
git push origin main

# 2. Wait for Vercel deployment

# 3. If schema changed, run migration
railway run npx prisma migrate deploy

# 4. If new templates added, update seed script and re-run
railway run npm run db:seed-email-templates
```

---

## Environment-Specific Notes

### Production
```bash
# Use Railway CLI for production database
railway link [your-production-project]
railway run npm run db:seed-email-templates
```

### Staging/Preview
```bash
# Use separate database if available
# Or run against production with caution
railway run npm run db:seed-email-templates
```

### Development
```bash
# Local database
npm run db:migrate
npm run db:seed-email-templates
```

---

## Quick Reference Commands

```bash
# Full deployment sequence
vercel deploy --prod                    # Deploy code
railway run npx prisma migrate deploy   # Run migrations
railway run npm run db:seed-email-templates  # Seed templates

# Verify deployment
railway run npx prisma studio           # Check database
# Visit: https://your-app.vercel.app/admin/email-templates

# Re-seed templates (safe to run multiple times)
railway run npm run db:seed-email-templates
```

---

## Remember

1. **Always run migration before seeding templates**
2. **Seeding is safe to run multiple times** (uses upsert)
3. **Template content won't be overwritten** if already customized
4. **Test in staging before production** when possible
5. **Verify in admin panel** after seeding

---

**Last Updated**: January 2026
