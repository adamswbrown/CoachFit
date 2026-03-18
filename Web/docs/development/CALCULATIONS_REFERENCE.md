# CoachFit Calculations Reference

Complete documentation of all calculations performed by the CoachFit platform. Use this guide when explaining metrics and data to clients.

---

## Overview

CoachFit performs calculations across three main categories:

1. **Body Measurements** - BMI and body composition
2. **Time-Based Aggregations** - Averages over date ranges
3. **Trends & Change Metrics** - Progress tracking

---

## 1. Body Measurements

### 1.1 BMI (Body Mass Index)

**Purpose**: Standard health metric showing the relationship between weight and height.

**Formula**:
```
BMI = (Weight in Pounds / (Height in Inches)²) × 703
```

**Example**:
- Client: 180 lbs, 70 inches tall
- Calculation: (180 / (70 × 70)) × 703 = (180 / 4900) × 703 = **25.8**

**Interpretation**:
- Underweight: BMI < 18.5
- Normal Weight: BMI 18.5 - 24.9
- Overweight: BMI 25.0 - 29.9
- Obese: BMI ≥ 30.0

**Implementation**: [lib/bmi.ts](lib/bmi.ts)

**Data Points**:
- `latestBMI`: BMI calculated from most recent weight + height entry
- `firstBMI`: BMI calculated from oldest weight + height entry
- `bmiChange`: latestBMI - firstBMI (positive = increased BMI, negative = decreased)
- `avgBMI`: Average BMI across all entries in selected period

**Notes**:
- Requires both weight AND height to calculate
- Returns `null` if either measurement is missing
- Rounded to 1 decimal place
- Only coaches can see BMI values (client privacy)

---

## 2. Time-Based Aggregations

These metrics aggregate entry data across specific date ranges.

### 2.1 7-Day Averages

**Purpose**: Show recent weekly trends and current performance level.

**Calculation**:
```
Average = Sum of values in last 7 days / Count of values in last 7 days
```

**Metrics**:
- `avgSteps7d`: Average daily steps from last 7 days
- `avgCalories7d`: Average daily calories from last 7 days

**Example**:
- Steps this week: [8,000, 0, 9,500, 7,200, 10,500, 0, 6,800]
- Values with data: [8,000, 9,500, 7,200, 10,500, 6,800] = 5 entries
- Calculation: (8,000 + 9,500 + 7,200 + 10,500 + 6,800) / 5 = **8,400 steps**

**Implementation**: [app/api/clients/[id]/analytics/route.ts](app/api/clients/[id]/analytics/route.ts#L106)

**Notes**:
- Only counts entries with actual data (ignores null/missing values)
- Rounded to nearest whole number
- If no data in 7 days: returns `null`

### 2.2 30-Day Averages

**Purpose**: Show monthly trends and longer-term consistency.

**Calculation**: Same as 7-day, but across 30-day window.

**Metrics**:
- `avgSteps30d`: Average daily steps from last 30 days
- `avgCalories30d`: Average daily calories from last 30 days

**Example**:
- 30 days of calorie data: sum = 72,000 total calories
- Days with entries: 24 days
- Calculation: 72,000 / 24 = **3,000 calories/day**

**Notes**:
- More reliable than 7-day for spotting trends
- Accounts for inconsistent entry patterns
- Returns `null` if no data in period

---

## 3. Trend & Change Metrics

### 3.1 Weight Change

**Purpose**: Track overall progress in weight loss or gain.

**Formula**:
```
Weight Change = Latest Weight - First Weight
```

**Example**:
- Start: 200 lbs
- Current: 185 lbs
- Change: 185 - 200 = **-15 lbs** (15 lb loss)

**Calculation Types**:
- `weightChange`: Change from first entry to most recent
- `avgWeight`: Average weight across selected period
- Displayed on charts as trend line

**Notes**:
- Negative = weight loss (good for most clients)
- Positive = weight gain (may be intentional for strength training)
- Calculated from entries with weight data only

### 3.2 BMI Change

**Purpose**: Track body composition change using BMI metric.

**Formula**:
```
BMI Change = Latest BMI - First BMI
```

**Example**:
- Starting BMI: 28.5 (overweight)
- Current BMI: 26.2 (overweight, but improving)
- Change: 26.2 - 28.5 = **-2.3**

**Notes**:
- Same sign convention as weight change
- Only shown when both weight and height available
- More holistic than weight alone (accounts for height)

### 3.3 Check-In Rate

**Purpose**: Measure client engagement/adherence.

**Formula**:
```
Check-In Rate (%) = (Entries in Period / Days in Period) × 100
```

**Example - Weekly**:
- 7 days in week
- Entries submitted: 5
- Rate: (5 / 7) × 100 = **71.4%**

**Example - Monthly**:
- 30 days in month
- Entries submitted: 22
- Rate: (22 / 30) × 100 = **73.3%**

**Implementation**: Calculated in analytics endpoints

**Notes**:
- High adherence (>80%) = excellent engagement
- Medium (60-80%) = good engagement
- Low (<60%) = needs encouragement
- Used for coaching insights

---

## 4. Unit Conversions

The platform uses imperial units (lbs, inches) internally but HealthKit provides metric data.

### 4.1 Weight Conversions

**Kilograms to Pounds**:
```
lbs = kg × 2.20462
```

**Example**: 85 kg = 85 × 2.20462 = **187.4 lbs**

**Pounds to Kilograms**:
```
kg = lbs × 0.453592
```

**Example**: 180 lbs = 180 × 0.453592 = **81.6 kg**

**Implementation**: [lib/utils/unit-conversions.ts](lib/utils/unit-conversions.ts)

### 4.2 Height Conversions

**Meters to Inches**:
```
inches = meters × 39.3701
```

**Example**: 1.75 m = 1.75 × 39.3701 = **69 inches**

**Centimeters to Inches**:
```
inches = cm × 0.393701
```

**Example**: 180 cm = 180 × 0.393701 = **71 inches**

**Inches to Centimeters**:
```
cm = inches × 2.54
```

**Example**: 70 inches = 70 × 2.54 = **178 cm**

### 4.3 Precision Standards

All conversions are rounded for human-readable results:
- Weight: 1 decimal place (e.g., 85.3 kg)
- Height: Nearest integer for inches (e.g., 70 inches)
- Height in metric: 1 decimal place (e.g., 178.0 cm)

---

## 5. Analytics Calculations

### 5.1 Client Analytics Summary

**Endpoint**: `GET /api/clients/[id]/analytics`

**Returns**:
```json
{
  "summary": {
    "latestWeight": 185,
    "firstWeight": 200,
    "weightChange": -15,
    "latestBMI": 25.8,
    "firstBMI": 28.7,
    "bmiChange": -2.9,
    "avgSteps7d": 8400,
    "avgSteps30d": 7950,
    "avgCalories7d": 2400,
    "avgCalories30d": 2380
  },
  "entries": [
    {
      "date": "2026-01-14",
      "weightLbs": 185,
      "steps": 8500,
      "calories": 2450,
      "sleepQuality": 8,
      "perceivedStress": 7,
      "bmi": 25.8
    }
  ]
}
```

### 5.2 Cohort Analytics Summary

**Endpoint**: `GET /api/cohorts/[id]/analytics`

**Cohort-Level Metrics**:
- `activeClients`: Clients with entries in last 14 days
- `avgWeightChange`: Average of all clients' weight change
- `avgSteps7d`: Aggregate 7-day average across cohort
- `avgSteps30d`: Aggregate 30-day average across cohort

**Per-Client Data Includes**:
- Individual averages (7d and 30d)
- Weight trends
- Sparkline data (last 30 days for charts)

---

## 6. Coach Notes & Insights

### 6.1 Weekly Summary Calculations

**Endpoint**: `GET /api/clients/[id]/weekly-summary`

**Calculates**:
- Check-in count for week
- Check-in rate percentage
- Average weight for week
- Weight trend (comparing to previous week)
- Average steps, calories, sleep quality
- Perceived effort averages
- Adherence score

**Example Week**:
```
Week: Jan 7-13, 2026
Entries submitted: 5 days
Check-in rate: 5/7 = 71%
Avg weight: 184.8 lbs
Weight trend: -0.4 lbs (slight loss)
Avg steps: 8200/day
Avg perceived effort: 6.8/10
Adherence: Good (71%)
```

---

## 7. Admin Dashboard Calculations

### 7.1 System-Level Metrics

**Calculated Daily**:
- **User Growth**: New users added per day/week
- **Coach Utilization**: 
  - Total coaches
  - Active coaches (assigned clients)
  - Overloaded (>20 clients)
  - Underutilized (<5 clients)
- **Client Engagement**:
  - Active rate: Clients with entries in last 14 days
  - Completion rate: Avg check-in consistency
- **Entry Metrics**:
  - Total entries
  - Last 7 days volume
  - Expected vs actual entries
  - Daily average

**Example Dashboard Data**:
```
Total Users: 207
Active Coaches: 9/10 (90%)
Client Engagement: 196/200 active (98%)
Entry Completion: 8,200 entries in last 30 days
Daily Average: 274 entries/day
```

### 7.2 Trend Calculations

**Direction**: "up" | "down" | "stable"

**Percentage Change**:
```
% Change = ((New Value - Old Value) / Old Value) × 100
```

**Example**:
- Last week entries: 1,800
- This week entries: 1,950
- Change: ((1,950 - 1,800) / 1,800) × 100 = **8.3% increase**

---

## 8. HealthKit Data Processing

### 8.1 Workout Data

**Aggregated From HealthKit**:
- `caloriesActive`: Sum of active calories across all workouts for the day
- `durationSecs`: Total workout duration for the day

**Example**:
```
Workouts on Jan 14:
- Morning run: 450 kcal, 30 mins
- Evening bike: 380 kcal, 45 mins
- Total: 830 kcal, 75 mins
```

### 8.2 Sleep Data

**From HealthKit Sleep Records**:
- `totalSleepMins`: Total minutes asleep
- `inBedMins`: Total time in bed (includes awake time)
- `awakeMins`: Time awake during sleep period
- Sleep stages: Core, Deep, REM (if available)

**Example**:
```
Sleep on Jan 13 (night):
- In bed: 8 hours (480 mins)
- Asleep: 7.5 hours (450 mins)
- Awake: 30 mins
- Deep sleep: 1.5 hours (90 mins)
- REM: 1 hour (60 mins)
```

---

## 9. Accuracy & Rounding Standards

### 9.1 Rounding Rules

| Metric | Rounding | Example |
|--------|----------|---------|
| Weight | 1 decimal place | 185.3 lbs |
| Height | Nearest integer | 70 inches |
| BMI | 1 decimal place | 25.8 |
| Steps | Nearest whole number | 8,450 steps |
| Calories | Nearest whole number | 2,385 cal |
| Percentages | 1 decimal place | 73.5% |
| Averages | Nearest whole number | 8,200 steps |

### 9.2 Null Value Handling

**When is data `null`?**
- BMI: Missing weight OR height
- Averages: No data in date range
- Weight change: Less than 2 data points
- Check-in rate: Zero days in period

**Display Standard**: Show "—" (em dash) instead of null in UI

---

## 10. Client Communication Examples

### Example 1: Weight Loss Progress
**Coach Explanation**:
> "Your weight is down from 200 lbs to 185 lbs—that's 15 pounds lost. Your BMI improved from 28.7 to 25.8, moving you from the obese category into overweight. Your 30-day average shows 7,950 steps per day. Keep up the consistency!"

### Example 2: Engagement Concern
**Coach Explanation**:
> "I notice your check-in rate dropped to 57% last week. You submitted 4 out of 7 possible days. I'd like to see at least 5 days—it helps me track your progress and give better feedback. Can we talk about what's making it hard to check in?"

### Example 3: HealthKit Data
**Coach Explanation**:
> "Your Apple Watch shows you averaged 8,400 steps per day this week, with about 450 minutes of active workouts. Your sleep data shows 7.5 hours per night with good deep sleep (90 minutes). This is great consistency!"

### Example 4: BMI Context
**Coach Explanation**:
> "BMI is one metric we track, but it's not the whole story. Your BMI of 25.8 puts you at the edge of overweight, but combined with your 30-day calorie data (2,380/day) and strength training, we're building lean muscle. Focus on the performance metrics too."

---

## 11. Performance Notes

### 11.1 Database Query Efficiency

**Analytics Queries**:
- Indexed on: `userId`, `date`, `[userId, date]`
- Time complexity: O(n) where n = entries in range
- Typical 30-day query: <100ms for 40+ entries

**Aggregation Strategy**:
- Filters data in memory (Prisma)
- Calculations in JavaScript
- Future optimization: Move to database for large datasets

### 11.2 Calculation Accuracy

All calculations maintain sufficient precision:
- **Intermediate calculations**: Full precision (not rounded)
- **Final results**: Rounded per standards above
- **No cascading errors**: Each metric calculated independently

---

## 12. Updating This Document

When adding new calculations:
1. Add section with clear formula
2. Provide example with real numbers
3. Document edge cases (null handling, edge values)
4. Link to implementation files
5. Add coach communication example

Last updated: January 14, 2026
