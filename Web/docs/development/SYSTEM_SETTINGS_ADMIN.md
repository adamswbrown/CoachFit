# System Settings Administration Guide

## Overview

Admin users can now modify customer-facing configuration values through the Settings page at `/admin/settings`. This allows runtime adjustment of engagement thresholds and coach limits without code changes.

---

## What Can Be Modified

### Coach Capacity Management

**Max Clients per Coach** (Default: 50)
- When a coach's client count exceeds this, they're flagged as "overloaded"
- Triggers RED attention alert
- Adjustable from 5-200

**Min Clients per Coach** (Default: 10)
- When a coach has fewer clients than this, they're flagged as "underutilized"
- Triggers AMBER attention alert
- Adjustable from 1-50

### Engagement & Activity Tracking

**Recent Activity Days** (Default: 14)
- How many days back to look when checking for "recent activity"
- Used in engagement calculations and attention scoring
- Adjustable from 1-90 days

**Low Engagement Entries** (Default: 7)
- Entries threshold within the recent activity window
- Below this number triggers a low engagement alert
- Adjustable from 1-30

**No Activity Days** (Default: 14)
- Days without any check-in entries before alerting coach/admin
- Triggers AMBER alert (needs attention)
- Adjustable from 5-180 days

**Critical No Activity Days** (Default: 30)
- Days without entries before escalating to critical alert
- Triggers RED alert (critical intervention needed)
- Adjustable from 10-365 days

### Check-In Defaults & Reminders

**Default Check-in Frequency (Days)** (Default: 7)
- Used when no cohort or user override is set
- Applies to reminders and check-in expectations
- Adjustable from 1-365 days

**Reminder Send Time (UTC)** (Default: 09:00)
- Global UTC time for scheduled reminders
- Applies to scheduled and missed check-in reminders

### Attention Policy (Weekly Missed Check-ins)

**Missed Check-in Severity** (Default: option_a)
- Option A: missed 2+ = red, missed 1 = amber, missed 0 = green
- Option B: missed 1+ = red, missed 0 = green
- Controls how weekly missed check-ins affect attention priority

### Analytics Time Windows

**Short-Term Window** (Default: 7)
- Days for calculating short-term averages (e.g., avgSteps7d)
- Adjustable from 1-30 days

**Long-Term Window** (Default: 30)
- Days for calculating long-term averages (e.g., avgSteps30d)
- Adjustable from 7-365 days

---

## Technical Reference (Read-Only)

The Settings page also displays all technical constants that are hardcoded and should only be changed via code:

### Authentication & Security
- Session Max Age: 1 hour
- Password Hash Rounds: 10 (bcrypt iterations)

### Pairing & Devices
- Pairing Code Length: 6 characters
- Pairing Code Character Set: ABCDEFGHJKLMNPQRSTUVWXYZ23456789
- Pairing Code Expiry: 24 hours

### Unit Conversions
- KG to LBS: 2.20462
- LBS to KG: 0.453592
- Meters to Inches: 39.3701
- CM to Inches: 0.393701
- Inches to CM: 2.54

### BMI Calculation
- Formula Multiplier: 703
- Rounding: 1 decimal place

### Test Data
- Total Test Admins: 2
- Total Test Coaches: 10
- Total Test Clients: 200

---

## How to Access Settings

1. Login as an Admin user
2. Navigate to `/admin/settings`
3. Modify values as needed
4. Click "Save Settings" to apply changes
5. Click "Reset" to undo unsaved changes

---

## Implementation Details

### Database Model

Settings are stored in the `SystemSettings` table:

```prisma
model SystemSettings {
  id        String   @id @default(uuid())
  maxClientsPerCoach Int @default(50)
  minClientsPerCoach Int @default(10)
  recentActivityDays Int @default(14)
  lowEngagementEntries Int @default(7)
  noActivityDays Int @default(14)
  criticalNoActivityDays Int @default(30)
  attentionMissedCheckinsPolicy String @default("option_a")
  shortTermWindowDays Int @default(7)
  longTermWindowDays Int @default(30)
  defaultCheckInFrequencyDays Int @default(7)
  notificationTimeUtc String @default("09:00")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### API Endpoints

**GET /api/admin/settings**
- Retrieves current system settings
- Admin-only
- Creates default settings if none exist

**PUT /api/admin/settings**
- Updates system settings
- Admin-only
- Validates all input values
- Enforces min < max relationships

### Usage in Code

To use system settings in your code:

```typescript
import { getSystemSettings, getSystemSetting } from "@/lib/system-settings"

// Get all settings
const settings = await getSystemSettings()
console.log(settings.maxClientsPerCoach) // 50

// Get specific setting
const maxClients = await getSystemSetting("maxClientsPerCoach")
```

---

## Migration & Updates

The system settings are:

- **Automatically created** on first use with default values
- **Persistent** across code deployments
- **Validated** to ensure logical constraints (e.g., min < max)
- **Documented** in admin UI with descriptions

---

## Future Enhancements

Potential improvements (Phase 2):

1. **Audit trail** - Track who changed settings and when
2. **Snapshots** - Save historical settings snapshots
3. **Email templates** - Let admins customize engagement emails
4. **Scoring weights** - Adjust how much each factor affects attention scores
5. **Time-based rules** - Different settings for different times of year
6. **Export/Import** - Backup and restore settings across instances

---

## Testing Settings Changes

When you change a setting, test the impact:

```bash
# After changing maxClientsPerCoach to 40:
1. Assign a coach with 40+ clients
2. Check attention scores for that coach
3. Should show RED (overloaded)
4. Admin dashboard should reflect change

# After changing noActivityDays to 7:
1. Create a client with last entry 8 days ago
2. Check attention scores
3. Should show AMBER (needs attention)
4. Coach dashboard should flag the client
```

---

## Example: Adjusting for Holiday Period

If you want more lenient engagement tracking during holidays:

1. Go to `/admin/settings`
2. Increase "No Activity Days" from 14 to 21
3. Increase "Critical No Activity Days" from 30 to 45
4. Save settings
5. Engagement alerts will be less strict
6. After holidays, reset values back to normal

---

Last Updated: January 23, 2026
