# CoachFit Static Values & Configuration Constants

Complete reference for all static values, limits, thresholds, and configuration parameters used throughout the CoachFit platform.

---

## Overview

This document lists all hardcoded constants that govern system behavior, limits, and calculations. Update this when changing any of these values.

---

## 1. Authentication & Session Management

### 1.1 Session Configuration

| Constant | Value | Purpose | Location |
|----------|-------|---------|----------|
| Session Strategy | `jwt` | Authentication strategy used | [lib/auth.ts](lib/auth.ts) |
| Session Max Age | `3,600` seconds (1 hour) | How long a session lasts before re-authentication required | [lib/auth.ts#L14](lib/auth.ts#L14) |
| Password Hash Rounds | `10` | Bcrypt rounds for password hashing (security) | [lib/auth.ts](lib/auth.ts), scripts |

**Explanation**:
- Users must re-login after 1 hour of inactivity
- Higher hash rounds = slower but more secure password hashing
- Changing session max age affects all users globally

---

## 2. Pairing & Device Management

### 2.1 HealthKit Pairing Codes

| Constant | Value | Purpose | Location |
|----------|-------|---------|----------|
| Code Length | `6` characters | Pairing code character count | [lib/healthkit/pairing.ts#L11](lib/healthkit/pairing.ts#L11) |
| Code Character Set | `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` | Allowed characters (no 0/O, I/L confusion) | [lib/healthkit/pairing.ts#L9](lib/healthkit/pairing.ts#L9) |
| Code Expiry Time | `24` hours | How long until a pairing code expires | [lib/healthkit/pairing.ts#L12](lib/healthkit/pairing.ts#L12) |
| Max Code Generation Attempts | `10` | Retries before failing to generate unique code | [lib/healthkit/pairing.ts#L59](lib/healthkit/pairing.ts#L59) |

**Examples**:
- Valid codes: `AB3H7K`, `ZX2M9P` (6 chars from character set)
- Invalid codes: `AB3H7K0` (7 chars), `AB3HI1` (contains I and 1)
- Code lifetime: Generated at 2:00 PM → Expires at 2:00 PM next day

**Explanation**:
- Character set excludes ambiguous characters to prevent user confusion
- 24-hour expiry balances security with user convenience
- 10 retries provides collision protection for 34^6 possible codes (~1.5 billion)

---

## 3. Coach Management & Limits

### 3.1 Client Load Thresholds

| Constant | Value | Purpose | Location |
|----------|-------|---------|----------|
| Max Recommended Clients per Coach | `50` | Threshold for "overloaded" status | [lib/admin/attention.ts#L212](lib/admin/attention.ts#L212) |
| Min Recommended Clients per Coach | `10` | Threshold for "underutilized" status | [lib/admin/attention.ts#L234](lib/admin/attention.ts#L234) |

**Explanation**:
- Coaches with >50 clients trigger RED alert (overloaded)
- Coaches with <10 clients trigger AMBER alert (underutilized)
- Used for attention scoring and admin insights
- Can be adjusted based on actual coaching capacity

**Examples**:
```
Coach A: 52 clients → RED (overloaded)
Coach B: 35 clients → GREEN (optimal)
Coach C: 8 clients → AMBER (underutilized)
```

---

## 4. Engagement & Activity Thresholds

### 4.1 Check-In Tracking

| Constant | Value | Purpose | Location |
|----------|-------|---------|----------|
| Recent Activity Window | `14` days | How far back to check for recent check-ins | [lib/admin/attention.ts#L400](lib/admin/attention.ts#L400), analytics |
| Low Engagement Threshold | `7` entries in 14 days | Below this = needs attention | [lib/admin/attention.ts](lib/admin/attention.ts) |
| No Activity Alert Threshold | `14` days | No entries in 14 days = send alert | [lib/admin/attention.ts](lib/admin/attention.ts) |
| Critical No Activity | `30` days | No entries in 30 days = critical alert | [lib/admin/attention.ts](lib/admin/attention.ts) |

**Explanation**:
- "Active client" = at least 1 entry in last 14 days
- Used to calculate engagement metrics on admin dashboard
- Affects attention scoring (red/amber/green flags)

**Examples**:
```
Client submitted entries on: Jan 14, Jan 12, Jan 10
Check-in rate (14d): 3/14 = 21% (LOW - needs attention)

Coach has 200 clients with 168 entries total in 14 days
Expected: 200 × 14 = 2,800 entry opportunities
Engagement rate: 168/2,800 = 6% (very low)
```

### 4.2 Expected Entry Calculations

| Formula | Purpose |
|---------|---------|
| `expectedEntries = totalClients × 14` | Calculate how many entries expected in 14-day window (1 per client per day ideally) |
| `engagementRate = actualEntries / expectedEntries` | Measure team engagement as percentage |

---

## 5. Time-Based Analytics Windows

### 5.1 Analytics Date Ranges

| Window | Days | Purpose | Used For |
|--------|------|---------|----------|
| 7-day window | `7` days | Recent performance | Short-term trends |
| 30-day window | `30` days | Monthly trends | Long-term patterns |
| Lookback period | `14` days | Recent activity | Engagement scoring |

**Calculation Details**:
```typescript
// Example: Today is Jan 14
const now = new Date()
const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)  // Jan 7
const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // Dec 15
const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000) // Dec 31
```

---

## 6. BMI & Health Calculations

### 6.1 BMI Formula

| Constant | Value | Purpose |
|----------|-------|---------|
| BMI Multiplier | `703` | Imperial units constant in BMI formula | 
| BMI Rounding | `1 decimal place` | Display precision |

**Formula**: `BMI = (weight_lbs / height_inches²) × 703`

**Examples**:
```
180 lbs, 70 inches: (180 / 4900) × 703 = 25.8
200 lbs, 72 inches: (200 / 5184) × 703 = 27.1
```

---

## 7. Unit Conversion Constants

### 7.1 Weight Conversions

| Constant | Value | Purpose |
|----------|-------|---------|
| KG to LBS | `2.20462` | Convert kilograms to pounds |
| LBS to KG | `0.453592` | Convert pounds to kilograms |

**Precision**: Both values rounded to 1 decimal place in calculations

**Examples**:
```
85 kg = 85 × 2.20462 = 187.4 lbs
180 lbs = 180 × 0.453592 = 81.6 kg
```

### 7.2 Height Conversions

| Constant | Value | Purpose |
|----------|-------|---------|
| Meters to Inches | `39.3701` | Convert meters to inches |
| Inches to Meters | `0.0254` | Convert inches to meters |
| CM to Inches | `0.393701` | Convert centimeters to inches |
| Inches to CM | `2.54` | Convert inches to centimeters |

**Precision**: Heights rounded to nearest integer for inches, 1 decimal for metric

**Examples**:
```
1.75 m = 1.75 × 39.3701 = 69 inches
180 cm = 180 × 0.393701 = 71 inches
70 inches = 70 × 2.54 = 178 cm
```

---

## 8. Test Data Generation

### 8.1 Comprehensive Test Data Script

| Constant | Value | Purpose | Location |
|----------|-------|---------|----------|
| Total Admins | `2` | Number of admin test accounts | [scripts/generate-comprehensive-test-data.ts](scripts/generate-comprehensive-test-data.ts) |
| Total Coaches | `10` | Number of coach test accounts | [scripts/generate-comprehensive-test-data.ts](scripts/generate-comprehensive-test-data.ts) |
| Total Clients | `200` | Number of client test accounts | [scripts/generate-comprehensive-test-data.ts](scripts/generate-comprehensive-test-data.ts) |
| Total Cohorts | `15` | Number of cohorts | [scripts/generate-comprehensive-test-data.ts](scripts/generate-comprehensive-test-data.ts) |
| Days of Data | `30-90` | Historical data range per client | [scripts/generate-comprehensive-test-data.ts#L317](scripts/generate-comprehensive-test-data.ts#L317) |

### 8.2 Test Data Profiles

**Activity Distribution**:
```
Low Activity:    20% of clients    (4000 steps/day)
Moderate:        30% of clients    (8000 steps/day)
High:            30% of clients    (12000 steps/day)
Very High:       20% of clients    (15000 steps/day)
```

**Weight Variation** [scripts/generate-comprehensive-test-data.ts#L115]:
- Base weight: 120-180 lbs (varies per client)
- Daily variation: ±3 lbs (realistic fluctuation)
- Trend: -0.1 to +0.1 lbs/day (subtle changes)

**Steps Variation** [scripts/generate-comprehensive-test-data.ts#L120]:
- Base: Profile-dependent (4000-15000)
- Daily variation: ±25% of base (realistic variance)
- Floor: 1000 steps minimum

**Calories Variation** [scripts/generate-comprehensive-test-data.ts#L124]:
- Base: 1800-2600 kcal depending on activity
- Daily variation: ±20% of base
- Floor: 1000 kcal minimum

### 8.3 Basic Test Data Script

| Constant | Value | Purpose |
|----------|-------|---------|
| Basic Test Clients | `15` | Smaller dataset for quick testing |
| Basic Test Cohorts | `5` | Quick test setup |
| Data Range | `7-30 days` | Quick test history |

---

## 9. Data Retention & Cleanup

### 9.1 Archival Periods

| Data Type | Retention | Purpose |
|-----------|-----------|---------|
| Sessions | `90 days` | Planned for automated cleanup |
| Pairing Codes | `24 hours` (expiry) | Automatically removed after use/expiry |
| Test User Data | On-demand cleanup | Manually removed via cleanup script |
| Soft-deleted accounts | `30 days` (planned) | Grace period before permanent deletion |

---

## 10. Engagement Scoring

### 10.1 Attention Score Thresholds

| Threshold | Score | Priority | Meaning |
|-----------|-------|----------|---------|
| Score 0-29 | 0-29 | GREEN ✅ | Healthy |
| Score 30-59 | 30-59 | AMBER ⚠️ | Needs attention |
| Score 60-100 | 60-100 | RED 🔴 | Critical |

**Example Scoring**:
```
User with no entries for 20 days:
- Day 14-29: +25 points (AMBER)
- Day 30+: +40 points (RED)

Coach with 52 clients:
- >50 clients: +50 points (RED)

Coach with 8 clients:
- <10 clients: +10 points (AMBER)
```

---

## 11. Check-In Configuration

### 11.1 Default Enabled Fields

| Field | Enabled by Default |
|-------|-------------------|
| Weight | ✅ Yes |
| Steps | ✅ Yes |
| Calories | ✅ Yes |
| Sleep Quality | ✅ Yes |
| Perceived Effort | ✅ Yes |
| Notes | ✅ Yes |
| Custom Prompts | Per cohort |

**Coaches can customize per cohort** via `CohortCheckInConfig`.

---

## 12. Privacy & Security

### 12.1 Data Protection

| Setting | Value | Purpose |
|---------|-------|---------|
| Test User Email Suppression | Enabled | Prevent test emails from sending |
| Password Hash Algorithm | bcryptjs | Industry-standard hashing |
| Cascade Deletes | Enabled | Automatic cleanup on user deletion |
| Nullable Fields | Weight, height, etc. | Users can skip optional metrics |

---

## 13. Summary Table: All Critical Constants

| Category | Constant | Value | Impact if Changed |
|----------|----------|-------|-------------------|
| **Session** | Max Age | 1 hour | Logout frequency |
| **Pairing** | Code Length | 6 chars | Easier/harder to remember |
| **Pairing** | Expiry | 24 hours | Pairing window size |
| **Coach** | Max Clients | 50 | Overload threshold |
| **Coach** | Min Clients | 10 | Underutilization threshold |
| **Activity** | Recent Window | 14 days | Engagement calculation |
| **Activity** | Low Engagement | 7 entries | Alert threshold |
| **Analytics** | 7-day Window | 7 days | Trend granularity |
| **Analytics** | 30-day Window | 30 days | Trend granularity |
| **BMI** | Multiplier | 703 | Weight classification |
| **Conversions** | KG to LBS | 2.20462 | Weight accuracy |
| **Test Data** | Total Clients | 200 | Dataset size |

---

## 14. How to Change Constants

### Step 1: Identify Location
- Search codebase for the value
- Note all files that use it

### Step 2: Consider Impact
- Affects all users? (session timeout, limits)
- Affects new data only? (test data generation)
- Affects calculations? (BMI, conversions)

### Step 3: Update Consistently
- Update all occurrences together
- Update this documentation
- Update dependent calculations if needed

### Step 4: Test Changes
- Test with existing data
- Regenerate test data if needed
- Verify no breaking changes

### Example: Changing Max Clients per Coach

```typescript
// Before
const MAX_RECOMMENDED_CLIENTS = 50  // lib/admin/attention.ts

// After
const MAX_RECOMMENDED_CLIENTS = 75  // Changed to 75

// Impact:
// - Coaches with 51-75 clients now GREEN instead of RED
// - Admin dashboard insights update
// - No database migration needed
```

---

## 15. Current Configuration Summary

**For Demo Tomorrow:**
- Session timeout: 1 hour ✅
- Pairing codes: 24-hour expiry ✅
- Coach limits: 10-50 clients ✅
- Engagement window: 14 days ✅
- Test data: 207 users, 7,439 entries ✅

---

Last updated: January 14, 2026
Location: [docs/development/CALCULATIONS_REFERENCE.md](docs/development/CALCULATIONS_REFERENCE.md)
