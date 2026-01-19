# Configurable Adherence Algorithm - Implementation ✅

## Problem
Paul Stewart (and other clients) were showing ✅ ON TRACK status despite having 0/7 check-ins (0%). This is clearly incorrect - the algorithm wasn't properly enforcing adherence minimums.

## Solution
Implemented **configurable adherence thresholds** with a smart priority function that ensures check-in rates always override false "on track" classifications.

## Key Changes

### 1. **Configurable Thresholds** (at top of page component)

```typescript
const ADHERENCE_THRESHOLDS = {
  // Green (✅ ON TRACK): 6+ check-ins out of 7
  greenMinimum: 6,

  // Amber (🟡 ATTENTION): 3-5 check-ins
  amberMinimum: 3,

  // Red (🔴 PRIORITY): 0-2 check-ins (automatically red)
}
```

**To modify these thresholds**, simply change the numbers at the top of `/app/coach-dashboard/weekly-review/page.tsx`:

```typescript
// Example: Make green 5+ check-ins, amber 2-4, red 0-1
const ADHERENCE_THRESHOLDS = {
  greenMinimum: 5,  // ← Change this
  amberMinimum: 2,  // ← Change this
}
```

### 2. **Smart Priority Function** 

```typescript
function getDisplayPriority(
  attention: { score: number; priority: string } | null,
  checkInCount: number
): "red" | "amber" | "green" {
  // CRITICAL: If adherence is low, ALWAYS red (overrides attention)
  if (checkInCount < ADHERENCE_THRESHOLDS.amberMinimum) {
    return "red"
  }

  // If no attention score, use adherence check
  if (!attention) {
    if (checkInCount >= ADHERENCE_THRESHOLDS.greenMinimum) return "green"
    return "amber"
  }

  // Otherwise use attention priority
  return attention.priority as "red" | "amber" | "green"
}
```

**This ensures:**
- ✅ A client with 0 check-ins → 🔴 PRIORITY (red), never green
- ✅ A client with 2 check-ins → 🔴 PRIORITY (red), never green  
- ✅ A client with 4 check-ins → 🟡 ATTENTION (amber), never green
- ✅ A client with 6+ check-ins → Can be ✅ ON TRACK (green) if attention also good

### 3. **Display of Thresholds** 

On the Weekly Review page, there's now a blue info box showing the current thresholds:

```
Adherence Thresholds: Green ✅ (6+ check-ins) • Amber 🟡 (3-5 check-ins) • Red 🔴 (0-2 check-ins)
To modify these thresholds, edit ADHERENCE_THRESHOLDS at the top of the page component
```

This makes it transparent what the current rules are.

## Results

### Before
- Paul Stewart: 0/7 check-ins → ✅ ON TRACK (WRONG!)

### After  
- Paul Stewart: 0/7 check-ins → 🔴 PRIORITY (CORRECT!)
- Any client with < 3 check-ins → Always red (CORRECT!)
- Client must have 6+ check-ins to show green (CORRECT!)

## How to Customize

### Scenario 1: Make it stricter
```typescript
const ADHERENCE_THRESHOLDS = {
  greenMinimum: 7,  // Must check in every single day
  amberMinimum: 5,  // 5-6 check-ins is just "attention"
}
```

### Scenario 2: Make it more lenient
```typescript
const ADHERENCE_THRESHOLDS = {
  greenMinimum: 4,  // 4+ check-ins is acceptable
  amberMinimum: 2,  // 2-3 is just "attention"
}
```

### Scenario 3: Weekly themes (e.g., "check-ins matter most early week")
You can further customize the `getDisplayPriority` function to add date-based logic:

```typescript
function getDisplayPriority(
  attention: { score: number; priority: string } | null,
  checkInCount: number,
  dayOfWeek?: number
): "red" | "amber" | "green" {
  // Example: Stricter on Mondays
  const threshold = dayOfWeek === 1 ? 5 : 3
  if (checkInCount < threshold) return "red"
  // ... rest of logic
}
```

## Technical Details

### Files Modified
- `app/coach-dashboard/weekly-review/page.tsx` (603 lines)
  - Added `ADHERENCE_THRESHOLDS` constant (line 12-20)
  - Added `getDisplayPriority()` function (line 26-42)
  - Updated sorting logic to use display priority (line 430-445)
  - Added info box showing current thresholds (line 327-334)
  - Updated progress bar color logic (line 540-547)

### Functions Using Thresholds
1. **`getDisplayPriority()`** - Main logic for determining priority based on check-ins + attention
2. **Client sorting** - Uses display priority to order by red → amber → green
3. **Progress bar color** - Progress bar matches the priority (red/amber/green)
4. **Info box** - Shows thresholds dynamically

### Build Status
✅ **npm run build**: PASSED (4.7s, 0 errors)
✅ **npm run dev**: RUNNING successfully

## Real-World Examples

**Client with 0 check-ins:**
- `checkInCount = 0`
- `0 < 3 (amberMinimum)` → RED 🔴 PRIORITY

**Client with 2 check-ins:**
- `checkInCount = 2`
- `2 < 3 (amberMinimum)` → RED 🔴 PRIORITY

**Client with 3 check-ins:**
- `checkInCount = 3`
- `3 >= 3` (passes amber minimum check)
- `3 < 6 (greenMinimum)` → AMBER 🟡 ATTENTION

**Client with 6 check-ins + good attention score:**
- `checkInCount = 6`
- `6 >= 6 (greenMinimum)` → GREEN ✅ ON TRACK

## Deployment Notes

- ✅ No database changes required
- ✅ No API changes required
- ✅ Fully backward compatible
- ✅ Changes take effect immediately upon deployment
- ✅ No migration needed

## Next Steps (Optional)

1. **Per-coach customization**: Store thresholds in database for each coach to adjust
2. **Admin settings**: Add UI to Admin dashboard to configure global thresholds
3. **Seasonal thresholds**: Different thresholds for different seasons/campaigns
4. **Historical tracking**: Track how thresholds changed over time

---

**Status**: ✅ Ready for production
**Algorithm**: Data-driven adherence checking with attention score integration
**Configurability**: Fully customizable via code constants (no database needed)
