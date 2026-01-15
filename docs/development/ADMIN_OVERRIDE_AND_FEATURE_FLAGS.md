# Admin Override & Feature Flags Implementation

## Overview
Implemented two major administrative features:
1. **Admin Override**: Emergency backdoor access via email address
2. **Feature Flags**: Toggle visibility of HealthKit and iOS integration features

## Admin Override

### How It Works
- Configure an email address via admin settings OR environment variable
- Any user with that email automatically gets admin privileges
- Useful for emergency access or temporary admin elevation
- **Failsafe**: Environment variable works even if database is inaccessible

### Configuration

#### Method 1: Admin Settings UI (Requires Database Access)
1. Navigate to `/admin/settings`
2. Find the "Admin Override (Emergency Access)" section
3. Enter an email address (or leave empty to disable)
4. Save settings

#### Method 2: Environment Variable (Emergency Failsafe)
1. Set `ADMIN_OVERRIDE_EMAIL` in your `.env` file or deployment config:
   ```bash
   ADMIN_OVERRIDE_EMAIL=admin@example.com
   ```
2. Restart your application
3. Any user logging in with that email will have admin access

**Priority**: Environment variable is checked first, then database setting. This ensures you can always regain access even if the database is corrupted or inaccessible.

### Implementation Details
- **Environment Variable**: `ADMIN_OVERRIDE_EMAIL` (checked first, highest priority)
- **Database**: `SystemSettings.adminOverrideEmail` (nullable string, checked second)
- **Permission Check**: `isAdminWithOverride()` in `lib/permissions.ts`
  - Checks Role.ADMIN OR environment variable OR database setting
  - Case-insensitive email comparison
  - Graceful fallback: If database errors, environment variable still works
- **Backward Compatibility**: Original `isAdmin()` function preserved

## Feature Flags

### Available Flags
1. **HealthKit Integration** (`healthkitEnabled`)
   - Controls visibility of HealthKit data explorer
   - Default: enabled (true)

2. **iOS Integration** (`iosIntegrationEnabled`)
   - Controls visibility of iOS pairing functionality
   - Default: enabled (true)

### Configuration
1. Navigate to `/admin/settings`
2. Find the "Feature Flags" section
3. Toggle checkboxes to enable/disable features
4. Save settings

### What Gets Hidden
When a feature flag is disabled:
- Navigation links are removed from sidebar
- Direct page access shows "Feature Not Available" message with link back to dashboard
- API endpoints remain functional (only UI is affected)

### Implementation Details

#### Database Schema
```prisma
model SystemSettings {
  // ... existing fields
  adminOverrideEmail      String?  // Admin override email
  healthkitEnabled        Boolean  @default(true)
  iosIntegrationEnabled   Boolean  @default(true)
}
```

#### Helper Functions (`lib/system-settings.ts`)
```typescript
export async function isHealthKitEnabled(): Promise<boolean>
export async function isIOSIntegrationEnabled(): Promise<boolean>
```

#### Pages Affected
1. **HealthKit Data Explorer** (`/coach-dashboard/healthkit-data`)
   - Checks `healthkitEnabled` flag on page load
   - Shows disabled message if flag is false
   
2. **iOS Pairing** (`/coach-dashboard/pairing`)
   - Checks `iosIntegrationEnabled` flag on page load
   - Shows disabled message if flag is false

3. **Coach Navigation** (`components/layouts/CoachLayout.tsx`)
   - Fetches feature flags on mount
   - Conditionally renders navigation items based on flags

## API Endpoints

### GET /api/admin/settings
Returns all system settings including feature flags and admin override email.

### PUT /api/admin/settings
Updates system settings. Validates:
- `adminOverrideEmail`: Optional valid email or null
- `healthkitEnabled`: Boolean
- `iosIntegrationEnabled`: Boolean

## Testing

### Admin Override
1. Set `adminOverrideEmail` to a test user's email
2. Log in as that user
3. Verify admin navigation appears
4. Verify access to admin-only routes

### Feature Flags
1. Disable `healthkitEnabled` in admin settings
2. Navigate to `/coach-dashboard`
3. Verify "HealthKit Data" link is hidden from sidebar
4. Directly visit `/coach-dashboard/healthkit-data`
5. Verify "Feature Not Available" message appears
6. Repeat for `iosIntegrationEnabled` and pairing page

## Future Enhancements
- Config file support (currently database-only)
- More granular feature flags (per-user, per-cohort)
- Admin override audit logging
- Feature flag usage analytics
- API-level enforcement of feature flags (not just UI)

## Migration
```bash
npm run db:push
```

## Related Files
- `prisma/schema.prisma` - Database schema
- `lib/permissions.ts` - Admin override logic
- `lib/system-settings.ts` - Feature flag helpers
- `app/api/admin/settings/route.ts` - Settings API
- `app/admin/settings/page.tsx` - Admin UI
- `app/coach-dashboard/healthkit-data/page.tsx` - HealthKit page
- `app/coach-dashboard/pairing/page.tsx` - Pairing page
- `components/layouts/CoachLayout.tsx` - Navigation
