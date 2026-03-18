# Onboarding Quick Start Guide

**Ready to test the 11-step onboarding flow? Start here.**

---

## Setup (5 minutes)

### 1. Start Development Server
```bash
cd /Users/adambrown/Developer/CoachFit/Web
npm run dev
```

Server runs on `http://localhost:3000`

### 2. Create Test User & Set Password
```bash
npm run db:seed                           # Creates test users
npm run password:set client@test.local client123  # Enable email login
```

### 3. Login
1. Navigate to `http://localhost:3000/login`
2. Email: `client@test.local`
3. Password: `client123`
4. You'll be redirected to onboarding

---

## The Flow

### 9 Steps (5-10 minutes to complete)

| Step | Input | Purpose |
|------|-------|---------|
| 1 | Gender (M/F) | For BMR calculation |
| 2 | Units (lbs/kg, inches/cm) | Preferred measurement units |
| 3 | Current Weight | Starting point for plan |
| 4 | Height | For BMR calculation |
| 5 | Birth Date | For age in BMR formula |
| 6 | Primary Goal | lose/maintain/gain (affects calorie adjustment) |
| 7 | Target Weight | Goal weight |
| 8 | Activity Level | not_much/light/moderate/heavy (TDEE multiplier) |
| 9 | Plan Review | See calculated nutrition plan; edit macros if desired |

### Plan Review (Step 11)

The system calculates:
- **BMR** (Basal Metabolic Rate) using Mifflin-St Jeor formula
- **TDEE** (Total Daily Energy Expenditure) = BMR × activity multiplier
- **Daily Calorie Goal** = TDEE adjusted by goal (lose: -20%, maintain: 0%, gain: +500)
- **Macros** = default percents (40/30/30) converted to grams
- **Water** = weight in kg × 35 ml
- **Steps/Workouts** = optional daily/weekly targets

**You can edit macro percentages** before submitting.

### Completion

On submit:
- ✅ Calorie and protein validation against admin bounds
- ✅ Fitness goal stored in database (metric: kg, cm, kcal, grams)
- ✅ Unit preferences saved for future use
- ✅ Baseline weight/height entry created
- ✅ Redirect to client dashboard

---

## Useful Commands

```bash
# Reset and try again
npm run password:set client@test.local client123  # Refresh password
# Then logout and login again

# Check what was saved
npm run db:studio  # Opens Prisma Studio to view data
# Look in: UserGoals, UserPreference, Entry tables

# Generate test data with entries
npm run test:generate  # Creates multiple clients with entries

# View/edit admin settings
# Navigate to http://localhost:3000/admin/settings
# (Login as admin@test.local / admin123 first)
```

---

## Validation Rules

During onboarding, you may see errors:

| Error | Cause | Fix |
|-------|-------|-----|
| "Daily calories must be between 1000 and 5000 kcal" | Calculated calories outside admin bounds | Adjust weight, goal, or activity level |
| "Protein must be between 0.4-2.0g per pound" | Calculated protein outside admin bounds | Adjust weight or macro percents |
| "Percentages must sum to 100" | Edited macros don't add up | Adjust carbs/protein/fat percents |
| "Birth date is required" | Empty date | Select a date |
| "Weight must be greater than 0" | Invalid weight input | Enter positive number |

---

## Admin Configuration

Admins can customize onboarding at `/admin/settings`:

**Body Fat Percentages** (what % is "Low", "Medium", etc.?)
- Default: 12.5%, 20%, 30%, 37.5%

**Calorie Range** (what min/max is allowed?)
- Default: 1000-5000 kcal

**Protein Range** (what per-lb is allowed?)
- Default: 0.4-2.0 g/lb

**Default Macros** (what's the starting split?)
- Default: 40% carbs, 30% protein, 30% fat

Changes only affect **new onboardings**, not existing users.

---

## Testing

See [docs/development/ONBOARDING_TESTING.md](./ONBOARDING_TESTING.md) for comprehensive 99-test checklist.

**Quick smoke test** (2 minutes):
1. Complete all 11 steps
2. Check plan displays correctly
3. Edit macro percentages (+/- 5%)
4. Submit
5. Verify redirected to dashboard

---

## Troubleshooting

### "Onboarding page keeps showing Step 1"
- **Cause**: Page refresh (client-side state lost)
- **Solution**: Continue from where you left off; state doesn't persist across reloads (by design)

### "Redirected to login after completing onboarding"
- **Cause**: Session expired (JWT expires after 1 hour)
- **Solution**: Login again; your progress is saved in database

### "Admin settings don't affect onboarding"
- **Cause**: Changed settings AFTER user started onboarding
- **Solution**: Settings apply to new onboardings only; reset and re-do

### "Units don't match my preferences"
- **Cause**: Preferences cached in session
- **Solution**: Logout and login; or change preferences via user menu → "Change Units"

---

## What Gets Stored

After completing onboarding:

**UserGoals** (Metric values - for calculations)
- currentWeightKg, targetWeightKg, heightCm
- dailyCaloriesKcal, proteinGrams, carbGrams, fatGrams
- waterIntakeMl, dailyStepsTarget, weeklyWorkoutMinutes

**UserPreference** (Your unit choices)
- weightUnit: "lbs" or "kg"
- measurementUnit: "inches" or "cm"
- dateFormat: "MM/dd/yyyy", "dd/MM/yyyy", etc.

**Entry** (Baseline weight/height entry for today)
- weightLbs (converted from kg), heightInches (converted from cm)
- bodyFatPercentage (from your selection)

**User** (Flag)
- onboardingComplete: true

---

## Reset Onboarding

To start over:
1. Click user menu (top right)
2. Click "Reset Onboarding"
3. Confirm dialog
4. Will lose fitness goals but **keep unit preferences**
5. Redirected to onboarding Step 1

---

## Change Unit Preferences

After completing onboarding:
1. Click user menu (top right)
2. Click "Change Units"
3. Select new units (lbs/kg, inches/cm, date format)
4. Click Save
5. Your entry form will now use new units

---

## Integration with Entries

After onboarding:
- Entry form respects your saved **unit preferences**
- Baseline weight/height pre-populated from onboarding
- Body fat percentage stored and can be tracked over time

---

## Need Help?

- **Questions about calculations?** → See [lib/calculations/fitness.ts](../../lib/calculations/fitness.ts) comments
- **Questions about API?** → See [app/api/onboarding/](../../app/api/onboarding/) route.ts files
- **Questions about admin settings?** → See [docs/development/admin-settings.md](./admin-settings.md)
- **Want to run full test suite?** → See [docs/development/ONBOARDING_TESTING.md](./ONBOARDING_TESTING.md)

---

## Feature Summary

✅ 11-step fitness questionnaire  
✅ Metric-based calculations (BMR, TDEE, macros, water)  
✅ Admin-configurable validation ranges  
✅ Editable macro percentages with validation  
✅ Unit preference persistence  
✅ Reset with preference preservation  
✅ Role-based access (CLIENT only)  
✅ Comprehensive error handling  
✅ Full type safety & validation  

---

**Happy testing!** 🚀
