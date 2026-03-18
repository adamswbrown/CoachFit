# Onboarding Flow Testing Guide

This document provides a comprehensive testing checklist for the 9-step client onboarding flow. Use this to validate all functionality end-to-end.
Note: Body fat range and burned calories steps have been removed; any older test cases referencing them are obsolete.

## Test Environment Setup

### Prerequisites

Before testing, ensure:

1. **Development server running**:
   ```bash
   npm run dev
   ```

2. **Database populated with test data**:
   ```bash
   npm run db:seed                    # Create test users
   npm run password:set client@test.local client123  # Set password
   ```

3. **Admin settings configured** (optional):
   - Navigate to `/admin/settings` as an admin user
  - Review onboarding settings (calorie ranges, protein ranges, macro defaults)
   - Note: Tests use defaults if not customized

### Test Accounts

| Email | Password | Role | Purpose |
|-------|----------|------|---------|
| `client@test.local` | `client123` | CLIENT | Main onboarding testing account |
| `coach@test.local` | `coach123` | COACH | Optional: Verify coaches skip onboarding |
| `admin@test.local` | `admin123` | ADMIN | Optional: Verify admins skip onboarding |

## Test Categories

---

## 1. Access Control & Routing

### Test 1.1: Clients Redirect to Onboarding
- **Setup**: Client account that has not completed onboarding
- **Steps**:
  1. Login as `client@test.local`
  2. You should be immediately redirected to `/onboarding/client`
  3. Dashboard should not be accessible
- **Expected**: Redirect happens; onboarding page loads
- **Pass/Fail**: ___

### Test 1.2: Coaches Skip Onboarding
- **Setup**: Coach account
- **Steps**:
  1. Login as `coach@test.local`
  2. Should go to `/coach-dashboard`
  3. No onboarding redirect
- **Expected**: Coach sees their dashboard; no redirect
- **Pass/Fail**: ___

### Test 1.3: Admins Skip Onboarding
- **Setup**: Admin account
- **Steps**:
  1. Login as `admin@test.local`
  2. Should go to `/admin`
  3. No onboarding redirect
- **Expected**: Admin sees their dashboard; no redirect
- **Pass/Fail**: ___

### Test 1.4: Unauthenticated Users Redirect to Login
- **Setup**: No session
- **Steps**:
  1. Visit `/onboarding/client` directly without logging in
  2. Should redirect to `/login`
- **Expected**: Redirect to login page
- **Pass/Fail**: ___

---

## 2. Step 1: Gender Selection

### Test 2.1: Gender Selection Required
- **Steps**:
  1. Load onboarding page
  2. Click Next without selecting gender
- **Expected**: Error message appears; step doesn't advance
- **Pass/Fail**: ___

### Test 2.2: Male Selection
- **Steps**:
  1. Click "Male" button
  2. Click Next
- **Expected**: Step advances to Unit Selection (Step 2)
- **Pass/Fail**: ___

### Test 2.3: Female Selection
- **Steps**:
  1. Go back to Step 1
  2. Click "Female" button
  3. Click Next
- **Expected**: Step advances; selection is retained on back/forward
- **Pass/Fail**: ___

### Test 2.4: State Persistence
- **Steps**:
  1. Select gender, advance to Step 2
  2. Click Back
  3. Gender selection should still be selected
- **Expected**: Gender remains selected
- **Pass/Fail**: ___

---

## 3. Step 2: Unit Selection

### Test 3.1: Default Units (Imperial)
- **Steps**:
  1. Load Step 2
  2. Default units should be lbs and inches (US standard)
- **Expected**: "lbs" and "inches" are selected
- **Pass/Fail**: ___

### Test 3.2: Toggle to Metric
- **Steps**:
  1. Click "kg" toggle
  2. Click "cm" toggle
- **Expected**: Units switch; UI updates to show metric
- **Pass/Fail**: ___

### Test 3.3: Toggle Back to Imperial
- **Steps**:
  1. With metric selected, click "lbs" toggle
  2. Click "inches" toggle
- **Expected**: Units switch back; selections retained
- **Pass/Fail**: ___

### Test 3.4: Unit Preferences Saved
- **Steps**:
  1. Select metric (kg, cm)
  2. Complete onboarding
  3. After completion, go to user menu → Preferences
  4. Preferred units should be kg and cm
- **Expected**: Saved preference matches selection
- **Pass/Fail**: ___

---

## 4. Step 3: Current Weight Input

### Test 4.1: Weight Required
- **Steps**:
  1. Load Step 3
  2. Click Next without entering weight
- **Expected**: Error "Weight must be greater than 0"
- **Pass/Fail**: ___

### Test 4.2: Valid Weight (Imperial)
- **Steps**:
  1. Units: Imperial (lbs)
  2. Enter: 200 lbs
  3. Click Next
- **Expected**: Step advances; value retained
- **Pass/Fail**: ___

### Test 4.3: Valid Weight (Metric)
- **Steps**:
  1. Go back, change to metric (kg)
  2. Enter: 91 kg (≈ 200 lbs)
  3. Click Next
- **Expected**: Step advances; internally stored as metric
- **Pass/Fail**: ___

### Test 4.4: Boundary Testing
- **Steps**:
  1. Enter 0: Should show error "must be greater than 0"
  2. Enter 1001: Should show error "must be 1000 or less"
  3. Enter 0.5: Should show error
  4. Enter 999: Should pass
- **Expected**: Min: 1, Max: 1000 validated correctly
- **Pass/Fail**: ___

---

## 5. Step 4: Height Input

### Test 5.1: Height Required
- **Steps**:
  1. Load Step 4
  2. Click Next without entering height
- **Expected**: Error "Height must be greater than 0"
- **Pass/Fail**: ___

### Test 5.2: Valid Height (Imperial)
- **Steps**:
  1. Units: Imperial (inches)
  2. Enter: 72 inches
  3. Click Next
- **Expected**: Step advances
- **Pass/Fail**: ___

### Test 5.3: Valid Height (Metric)
- **Steps**:
  1. Go back, change to metric (cm)
  2. Enter: 183 cm (≈ 72 inches)
  3. Click Next
- **Expected**: Step advances
- **Pass/Fail**: ___

### Test 5.4: Boundary Testing
- **Steps**:
  1. Enter 0: Should show error
  2. Enter 301: Should show error "must be 300 or less"
  3. Enter 150 (cm): Should pass
- **Expected**: Min: 1, Max: 300 validated
- **Pass/Fail**: ___

---

## 6. Step 5: Birth Date Input

### Test 6.1: Birth Date Required
- **Steps**:
  1. Load Step 5
  2. Click Next without entering date
- **Expected**: Error "Birth date is required"
- **Pass/Fail**: ___

### Test 6.2: Valid Birth Date
- **Steps**:
  1. Enter: 01/15/1990
  2. Click Next
- **Expected**: Step advances; date is validated (valid format, not future)
- **Pass/Fail**: ___

### Test 6.3: Future Date Rejected
- **Steps**:
  1. Try to enter today's date or future date
  2. DatePicker should prevent selection (grayed out)
- **Expected**: Cannot select future date
- **Pass/Fail**: ___

### Test 6.4: Age Calculation
- **Steps**:
  1. Enter: 01/15/1990 (age ~34 if year is 2024)
  2. Complete onboarding
  3. The calculated BMR should use this age
  4. Open browser DevTools and check the calculated plan in network requests
- **Expected**: Age is correctly calculated and used in BMR formula
- **Pass/Fail**: ___

---

## 7. Step 6: Primary Goal Selection

### Test 8.1: Goal Required
- **Steps**:
  1. Load Step 7
  2. Click Next without selecting goal
- **Expected**: Error "Primary goal is required"
- **Pass/Fail**: ___

### Test 8.2: "Lose Weight" Selection
- **Steps**:
  1. Click "Lose Weight"
  2. Click Next
- **Expected**: Advances; plan will calculate calorie deficit (TDEE × 0.8)
- **Pass/Fail**: ___

### Test 8.3: "Maintain Weight" Selection
- **Steps**:
  1. Go back, click "Maintain Weight"
  2. Complete onboarding and check plan
- **Expected**: Plan calculates maintenance calories (TDEE × 1.0)
- **Pass/Fail**: ___

### Test 8.4: "Gain Weight" Selection
- **Steps**:
  1. Go back, click "Gain Weight"
  2. Complete onboarding and check plan
- **Expected**: Plan calculates surplus (TDEE + 500 kcal)
- **Pass/Fail**: ___

---

## 9. Step 8: Target Weight

### Test 9.1: Target Weight Required
- **Steps**:
  1. Load Step 8
  2. Click Next without entering target
- **Expected**: Error "Target weight is required"
- **Pass/Fail**: ___

### Test 9.2: Valid Target Weight
- **Steps**:
  1. Current weight: 200 lbs
  2. Target weight: 180 lbs
  3. Click Next
- **Expected**: Advances; target is stored
- **Pass/Fail**: ___

### Test 9.3: Target > Current (Gain Scenario)
- **Steps**:
  1. Current: 180 lbs
  2. Target: 200 lbs (gaining)
  3. Click Next
- **Expected**: Advances; allows higher target
- **Pass/Fail**: ___

### Test 9.4: Boundary Testing
- **Steps**:
  1. Enter 0: Error
  2. Enter 1001: Error "must be 1000 or less"
  3. Enter 150: Should pass
- **Expected**: Min: 1, Max: 1000
- **Pass/Fail**: ___

---

## 10. Step 9: Activity Level

### Test 10.1: Activity Required
- **Steps**:
  1. Load Step 9
  2. Click Next without selecting activity
- **Expected**: Error "Activity level is required"
- **Pass/Fail**: ___

### Test 10.2: Sedentary (1.2x multiplier)
- **Steps**:
  1. Click "Not Much"
  2. Complete onboarding
  3. TDEE should be BMR × 1.2
- **Expected**: Lowest calorie multiplier applied
- **Pass/Fail**: ___

### Test 10.3: Lightly Active (1.375x multiplier)
- **Steps**:
  1. Go back, select "Light"
  2. Check TDEE = BMR × 1.375
- **Expected**: Moderate multiplier
- **Pass/Fail**: ___

### Test 10.4: Moderately Active (1.55x multiplier)
- **Steps**:
  1. Go back, select "Moderate"
  2. Check TDEE = BMR × 1.55
- **Expected**: Higher multiplier
- **Pass/Fail**: ___

### Test 10.5: Very Active (1.725x multiplier)
- **Steps**:
  1. Go back, select "Heavy"
  2. Check TDEE = BMR × 1.725
- **Expected**: Highest multiplier
- **Pass/Fail**: ___

---

## 11. Step 10: Plan Review & Edits

### Test 12.1: Plan Displays Correctly
- **Steps**:
  1. Load Step 11 (Plan Review)
  2. Verify displayed metrics:
     - BMR (Mifflin-St Jeor formula)
     - TDEE (BMR × activity multiplier)
     - Daily Goal (TDEE adjusted for goal)
     - Water Goal (weight in kg × 35)
- **Expected**: All values calculated correctly
- **Pass/Fail**: ___

### Test 12.2: Macro Percents Display Correctly
- **Steps**:
  1. Check that carbs, protein, fat percents match admin defaults (or 40/30/30)
  2. Verify they sum to 100%
- **Expected**: Default macros shown; sum = 100
- **Pass/Fail**: ___

### Test 12.3: Edit Macro Percents
- **Steps**:
  1. Click on carbs % input
  2. Change from 40 to 35
  3. Change protein from 30 to 35
  4. Fat should adjust to 30 (to keep sum = 100, or user adjusts)
  5. Click Save Plan
- **Expected**: 
  - UI shows validation error if sum ≠ 100 before save
  - On save, percents → grams conversion happens
  - Plan recalculates with new macro split
- **Pass/Fail**: ___

### Test 12.4: Validation: Calorie Range
- **Steps**:
  1. Admin sets: minDailyCalories = 1200, maxDailyCalories = 3500
  2. Create onboarding that calculates to 900 calories
  3. Submit form
- **Expected**: Error "Daily calories must be between 1200 and 3500 kcal"
- **Pass/Fail**: ___

### Test 12.5: Validation: Protein Range
- **Steps**:
  1. Admin sets: minProteinPerLb = 0.8, maxProteinPerLb = 2.0
  2. Create 200 lb person
  3. Set protein to 100g (0.5 per lb, below min)
  4. Try to submit
- **Expected**: Error "Protein must be between 0.8-2.0g per pound of body weight"
- **Pass/Fail**: ___

### Test 12.6: Edit Water Goal
- **Steps**:
  1. Default water: weight in kg × 35
  2. Edit the water input (e.g., increase by 500ml)
  3. Click Save Plan
- **Expected**: New water value persisted and stored
- **Pass/Fail**: ___

### Test 12.7: Edit Steps & Workouts Goals
- **Steps**:
  1. Edit daily steps target
  2. Edit weekly workout minutes
  3. Click Save Plan
- **Expected**: Both values saved
- **Pass/Fail**: ___

### Test 12.8: Reset Plan to Defaults
- **Steps**:
  1. Make edits to macro %s, water, steps, workouts
  2. Click "Reset to Defaults" button
- **Expected**: All fields revert to calculated defaults
- **Pass/Fail**: ___

---

## 13. Submission & Completion

### Test 13.1: Successful Submission
- **Steps**:
  1. Complete all 11 steps with valid data
  2. Click "Complete Onboarding" on final review screen
- **Expected**:
  - POST /api/onboarding/submit succeeds
  - UserGoals created with metric values (kg, cm, kcal, grams)
  - UserPreference created with unit selections
  - User.onboardingComplete = true
  - Baseline Entry created with weight and height
  - Redirected to /client-dashboard
- **Pass/Fail**: ___

### Test 13.2: Database Persistence
- **Steps**:
  1. After submission, open Prisma Studio
  2. Check UserGoals record for the user
  3. Verify all values are metric (kg, cm, kcal, grams)
  4. Check UserPreference for saved units
  5. Check Entry table for baseline entry
- **Expected**: All data present and in correct metric format
- **Pass/Fail**: ___

### Test 13.3: Session Update
- **Steps**:
  1. After submission, open DevTools → Application → Cookies
  2. Check the session/jwt token payload
  3. Should contain isOnboardingComplete = true
- **Expected**: Token includes onboarding flag
- **Pass/Fail**: ___

### Test 13.4: Can Access Dashboard
- **Steps**:
  1. After submission, manually visit `/client-dashboard`
- **Expected**: Dashboard loads; no redirect to onboarding
- **Pass/Fail**: ___

### Test 13.5: Cannot Re-enter Onboarding
- **Steps**:
  1. After completion, manually visit `/onboarding/client`
  2. Try to reload the step page
- **Expected**: Redirected to `/client-dashboard` (not allowed to re-do)
- **Pass/Fail**: ___

---

## 14. Reset Onboarding Flow

### Test 14.1: Reset Button in Menu
- **Steps**:
  1. After completing onboarding, open user menu (top right)
  2. Click "Reset Onboarding"
  3. Confirm in dialog
- **Expected**: POST /api/onboarding/reset succeeds
- **Pass/Fail**: ___

### Test 14.2: State After Reset
- **Steps**:
  1. Reset onboarding
  2. Check database: UserGoals should be deleted
  3. UserPreference should still exist with same units
  4. User.onboardingComplete should be false
- **Expected**: Goals cleared, preferences preserved, flag reset
- **Pass/Fail**: ___

### Test 14.3: Redirect to Onboarding
- **Steps**:
  1. After reset, should be redirected to `/onboarding/client`
- **Expected**: Onboarding page loads with Step 1
- **Pass/Fail**: ___

### Test 14.4: Re-complete Onboarding
- **Steps**:
  1. After reset, complete onboarding again (may be different values)
  2. Submit
- **Expected**: 
  - New UserGoals created
  - Existing UserPreference updated (or new created)
  - New Entry created
  - onboarding completed again successfully
- **Pass/Fail**: ___

---

## 15. Preferences Flow

### Test 15.1: Open Preferences Modal
- **Steps**:
  1. After completing onboarding, open user menu
  2. Click "Change Units"
  3. Modal should open
- **Expected**: Modal shows with current units selected
- **Pass/Fail**: ___

### Test 15.2: Hydrate Current Preferences
- **Steps**:
  1. During onboarding, select metric (kg, cm, different date format)
  2. Complete onboarding
  3. Open preferences modal
- **Expected**: Modal prefills with saved metric selections
- **Pass/Fail**: ___

### Test 15.3: Change Units
- **Steps**:
  1. Open preferences modal
  2. Toggle from kg to lbs
  3. Toggle from cm to inches
  4. Click Save
- **Expected**: POST /api/onboarding/preferences succeeds; units persist
- **Pass/Fail**: ___

### Test 15.4: Change Date Format
- **Steps**:
  1. Open preferences modal
  2. Change date format from MM/dd/yyyy to dd/MM/yyyy
  3. Click Save
- **Expected**: Date format preference persisted
- **Pass/Fail**: ___

### Test 15.5: Verify Persistence on Reload
- **Steps**:
  1. Change preferences to metric
  2. Refresh page (hard refresh with Cmd+Shift+R)
  3. Open preferences modal again
- **Expected**: Preferences still show metric selections
- **Pass/Fail**: ___

---

## 16. Error Handling

### Test 16.1: Network Error on Submit
- **Steps**:
  1. Disable network (DevTools → Network → Offline)
  2. Try to submit onboarding
- **Expected**: Error message displayed; form remains filled; can retry
- **Pass/Fail**: ___

### Test 16.2: Server Error (5xx)
- **Steps**:
  1. (Requires manual server tampering or mock)
  2. Submit should show generic error message
- **Expected**: Graceful error handling
- **Pass/Fail**: ___

### Test 16.3: Validation Error Details
- **Steps**:
  1. Submit with calories outside range
  2. Should show specific error: "Daily calories must be between X and Y"
- **Expected**: Detailed error message, not generic
- **Pass/Fail**: ___

### Test 16.4: Missing Fields on Submit
- **Steps**:
  1. Go back and modify form data in DevTools
  2. Remove required fields
  3. Submit
- **Expected**: API returns 400 with validation error
- **Pass/Fail**: ___

---

## 17. Role-Based Access

### Test 17.1: Coach Cannot Access Onboarding
- **Setup**: Coach account
- **Steps**:
  1. Manually visit `/onboarding/client`
  2. Should redirect to coach dashboard
- **Expected**: Access denied; redirected
- **Pass/Fail**: ___

### Test 17.2: Admin Cannot Access Onboarding
- **Setup**: Admin account
- **Steps**:
  1. Manually visit `/onboarding/client`
  2. Should redirect to admin
- **Expected**: Access denied; redirected
- **Pass/Fail**: ___

### Test 17.3: API: Non-Client Role Rejected
- **Steps**:
  1. Login as coach
  2. Using DevTools, POST to /api/onboarding/submit with coach's session
  3. API should return 403 Forbidden
- **Expected**: Role check enforced on backend
- **Pass/Fail**: ___

---

## 18. Integration Tests

### Test 18.1: Full Flow (Happy Path)
- **Steps**:
  1. Login as fresh client
  2. Complete all 11 steps
  3. Submit onboarding
  4. Access client dashboard
  5. Open entry form and verify unit preferences applied
- **Expected**: End-to-end flow works; units persist to entry form
- **Pass/Fail**: ___

### Test 18.2: Unit Consistency
- **Steps**:
  1. During onboarding, select metric (kg, cm)
  2. Submit
  3. Check Entry form: should prompt in kg and cm
  4. Change preferences to imperial
  5. Entry form should now prompt in lbs and inches
- **Expected**: Units respected throughout app
- **Pass/Fail**: ___

### Test 18.3: Entry Creation with Baseline Data
- **Steps**:
  1. Complete onboarding
  2. Open Prisma Studio
  3. Find Entry for today's date
  4. Check: Entry.weightLbs (converted from kg), Entry.heightInches (converted from cm), Entry.bodyFatPercentage (from selection)
- **Expected**: Baseline entry exists with all three values set
- **Pass/Fail**: ___

### Test 18.4: Multiple Clients
- **Steps**:
  1. Create second client account or use different user
  2. Complete onboarding with different values
  3. Each client's data should be independent
- **Expected**: No data leakage between users
- **Pass/Fail**: ___

---

## 19. Admin Settings Integration

### Test 19.1: Custom Calorie Range Enforcement
- **Setup**: Admin sets minDailyCalories = 1500, maxDailyCalories = 3000
- **Steps**:
  1. Create client that calculates to 1200 calories
  2. Try to submit
- **Expected**: Validation error shown
- **Pass/Fail**: ___

### Test 19.2: Custom Protein Range Enforcement
- **Setup**: Admin sets minProteinPerLb = 1.0, maxProteinPerLb = 2.0
- **Steps**:
  1. Create 150 lb client
  2. Protein calculates to 90g (0.6 per lb, below min)
  3. Try to submit
- **Expected**: Error "Protein must be between 1.0-2.0g per pound"
- **Pass/Fail**: ___

### Test 19.3: Custom Macro Defaults
- **Setup**: Admin changes defaultCarbsPercent = 30, defaultProteinPercent = 40, defaultFatPercent = 30
- **Steps**:
  1. New client reaches Plan Review step
  2. Default macros should show 30/40/30
- **Expected**: Custom defaults displayed
- **Pass/Fail**: ___

---

## 20. Browser & Device Testing

### Test 20.1: Desktop (Chrome)
- **Steps**:
  1. Complete full onboarding on Chrome desktop
- **Expected**: All steps render correctly, no layout issues
- **Pass/Fail**: ___

### Test 20.2: Desktop (Safari)
- **Steps**:
  1. Complete full onboarding on Safari
- **Expected**: No styling issues, date picker works
- **Pass/Fail**: ___

### Test 20.3: Mobile (iPhone 12)
- **Steps**:
  1. Use DevTools mobile emulation
  2. Complete onboarding on mobile viewport
- **Expected**: 
  - Form inputs responsive
  - Buttons clickable (sufficient size)
  - No horizontal scroll
  - Modal/dialogs work
- **Pass/Fail**: ___

### Test 20.4: Mobile (Android)
- **Steps**:
  1. Use Android emulator or device
  2. Complete onboarding
- **Expected**: Same as iPhone
- **Pass/Fail**: ___

---

## 21. Performance & Edge Cases

### Test 21.1: Large Weight Values
- **Steps**:
  1. Enter 999 lbs (close to max)
  2. Complete onboarding
- **Expected**: No errors; calculations work correctly
- **Pass/Fail**: ___

### Test 21.2: Very Old Birth Date
- **Steps**:
  1. Enter birth date of 01/01/1920 (age 104)
  2. Complete onboarding
- **Expected**: BMR calculates correctly with realistic age
- **Pass/Fail**: ___

### Test 21.3: Extreme Goal
- **Steps**:
  1. Current: 200 lbs, Target: 100 lbs (50% loss)
  2. Complete onboarding
- **Expected**: Plan calculates large deficit; no errors
- **Pass/Fail**: ___

### Test 21.4: Page Reload Mid-Onboarding
- **Steps**:
  1. Fill out Steps 1-5
  2. Hard refresh page (Cmd+Shift+R)
- **Expected**: 
  - Onboarding restarts (form data not persisted across page reloads)
  - User starts over at Step 1 (expected behavior)
- **Pass/Fail**: ___

### Test 21.5: Back Button Navigation
- **Steps**:
  1. Complete Steps 1-7
  2. Click browser back button multiple times
  3. Click forward
- **Expected**: 
  - Back goes through steps (may lose data)
  - State not fully preserved (acceptable: client-side state only)
- **Pass/Fail**: ___

---

## Summary Checklist

| Category | Tests | Passed | Failed | Notes |
|----------|-------|--------|--------|-------|
| Access Control | 4 | ___ | ___ | |
| Step 1: Gender | 4 | ___ | ___ | |
| Step 2: Units | 4 | ___ | ___ | |
| Step 3: Weight | 4 | ___ | ___ | |
| Step 4: Height | 4 | ___ | ___ | |
| Step 5: Birth Date | 4 | ___ | ___ | |
| Step 6: Body Fat | 4 | ___ | ___ | |
| Step 7: Goal | 4 | ___ | ___ | |
| Step 8: Target | 4 | ___ | ___ | |
| Step 9: Activity | 5 | ___ | ___ | |
| Step 10: Burned Cal | 2 | ___ | ___ | |
| Step 11: Plan Review | 8 | ___ | ___ | |
| Submission | 5 | ___ | ___ | |
| Reset | 4 | ___ | ___ | |
| Preferences | 5 | ___ | ___ | |
| Error Handling | 4 | ___ | ___ | |
| Role-Based | 3 | ___ | ___ | |
| Integration | 4 | ___ | ___ | |
| Admin Settings | 4 | ___ | ___ | |
| Browser/Device | 4 | ___ | ___ | |
| Performance | 5 | ___ | ___ | |
| **TOTAL** | **99** | **___** | **___** | |

---

## Reporting Issues

If a test fails, document:

1. **Test ID**: (e.g., "Test 12.3: Edit Macro Percents")
2. **Steps to Reproduce**: Clear, numbered steps
3. **Expected**: What should happen
4. **Actual**: What actually happened
5. **Browser/Device**: Chrome on macOS, etc.
6. **Screenshots**: If helpful
7. **Console Errors**: Any JS errors in DevTools Console

Example bug report:
```
Test 12.3: Edit Macro Percents - FAILED
Steps:
  1. Load plan review
  2. Change carbs to 35
  3. Change protein to 35
  4. Click Save Plan
Expected: Percents should sum to 100; if not, show validation error
Actual: Save button is disabled even though 35+35+30=100. UI shows "Sum must equal 100" error incorrectly.
Browser: Chrome 120 on macOS 13
Console Error: None
```

---

## Maintenance

This testing guide should be updated whenever:
- New validation rules are added to onboarding
- New steps or fields are introduced
- Admin settings change impact onboarding behavior
- Bug fixes address specific test scenarios

**Last Updated**: [Date]
**Test Coverage**: 99 test cases across 21 categories
