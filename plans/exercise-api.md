Plan: Exercise API Integration + Configurable Workout Calculations
Complete Feature: Coach Workout Planning with ExerciseDB Integration, Calculation Configuration, and AI Progression Tracking

Integrate ExerciseDB API (1,500+ exercises with GIFs) enabling coaches to create reusable workout templates with flexible exercise configurations (sets/reps/duration). Equipment filtering per-cohort with coach customization. All calculations (progressive overload 5-10%, difficulty scoring, volume tracking, progression suggestions) documented, configurable at system level (admin) and per-cohort level (coach overrides). Features: fuzzy search discovery, monthly data sync with manual refresh, hotlinked GIF media, frozen assignments (copy-on-assign), in-app rest timer, AI-driven auto-suggestions after 2 consecutive completions within 7 days, rest day warnings, smart alternative exercise suggestions based on difficulty/muscle overlap, per-client progression tracking with batch approval UI, calculation audit trail.

Steps
Add database models to schema.prisma:

Exercise (exerciseId, name, gifUrl, targetMuscles[], equipments[], bodyParts[], secondaryMuscles[], difficulty: BEGINNER|INTERMEDIATE|ADVANCED, instructions[], lastSyncedAt)
WorkoutTemplate (coachId, name, description, isPublic, createdAt, updatedAt, exercises relationship)
TemplateExercise (join: templateId, exerciseId, sets, reps, durationSecs, restSecs, tempo, alternatives[{exerciseId, name}], notes)
WorkoutAssignment (templateId, clientId, cohortId, scheduledDate, completed, completedAt, notes, frozen exercise snapshot)
ExerciseLog (assignmentId, exerciseId, actualSets, actualReps, actualWeight, actualDuration, completedAt, calculationConfigVersion)
CohortWorkoutConfig (cohortId, availableEquipment[], calculations JSON with overrides)
ProgressionSuggestion (suggestedWeight, exerciseId, assignmentId, clientId, status: PENDING|ACCEPTED|DECLINED, reason, confidenceScore, createdAt)
WorkoutCalculationConfig (system-wide defaults: progressiveLoadCompoundPct, progressiveLoadIsolationPct, volumeIncreaseThreshold, restDayThreshold, maxWeeklyVolume, weightIncrementBands, createdBy, updatedBy, updatedAt)
Create calculation constants & formulas library at Web/lib/workout-calculations.ts:

calculateDifficultyScore(equipment, isCompound, instructions) - equipment type (bodyweight=1, machine=1.5, dumbbell=2.5, barbell=3.5) + complexity (accessory -0.5, compound +0.5) = difficulty score → maps to BEGINNER/INTERMEDIATE/ADVANCED
suggestProgressiveLoad(currentWeight, difficulty, exerciseType, config) - uses config thresholds: compound exercises 5%, isolation 10%, returns suggested weight with available increment (2.5kg <50kg, 5kg 50-100kg, 10kg >100kg)
calculateVolumeMetric(sets, reps, weight) - total reps × weight = volume score
validateRestDayCompliance(assignedDates, threshold) - checks gaps ≥threshold days
calculateConfidenceScore(logCount, spreadDays, consistency) - suggestion confidence 0-100% based on workout frequency and consistency
inferExerciseDifficulty(exercise) - algorithm using difficulty scoring from ExerciseDB data
All with inline comment documentation, parameter explanations, return values, and example calls
Create calculation documentation at Web/docs/calculations/WORKOUT_CALCULATIONS.md:

Formula descriptions with math notation: progressive overload (weight_new = weight_current × (1 + pct_increase)), volume (sets × reps × weight), difficulty scoring (equipment_score + complexity_modifier), rest day validation (min_gap ≥ threshold_days)
Progressive overload algorithm: compound exercises 5%, isolation 10%, weight increment bands based on current weight, examples for each exercise type
Volume tracking: sets × reps × weight per exercise, weekly volume trends, max weekly alerts
Difficulty scoring system: equipment types, complexity modifiers, mapping to BEGINNER/INTERMEDIATE/ADVANCED
Rest day validation: minimum gap days, consecutive workout warnings, recovery thresholds
Weight suggestion algorithm: confidence scoring, available increment selection, rounding rules
Configurable vs hardcoded parameters table
Examples with real numbers (e.g., 50kg barbell bench for 8 reps → suggests 52.5kg)
Edge cases: null weight tracking, first workout suggestion, new exercise detection
Links to implementation files
Build admin calculation settings UI at page.tsx:

Add "Workout Calculations" section after existing settings
Form fields with descriptions and ℹ️ icons linking to docs:
progressiveLoadCompoundPct (default 5%, range 1-15%)
progressiveLoadIsolationPct (default 10%, range 5-25%)
volumeIncreaseThreshold (default 5 sets/week increase)
restDayThreshold (default 1 day minimum between workouts)
maxWeeklyVolumeAlert (default 20 sets/week warning)
Weight increment bands: <50kg=2.5kg, 50-100kg=5kg, >100kg=10kg (with validation)
Save via Web/app/api/admin/workout-config/route.ts (GET/PUT with admin-only auth)
Display "Last Updated by [user]" timestamp, change reason text field
Visual indicator showing which values are system defaults vs recently changed
"Reset to Defaults" button with confirmation dialog
Audit trail link to Web/docs/audit/CALCULATION_CHANGES.md
Build coach per-cohort calculation overrides in Web/app/cohorts/[id]/page.tsx:

Add "Workout Calculations" tab alongside "Equipment & Training" tab
Toggle "Override System Defaults" checkbox
If checked, show editable fields (matching admin form) with current system defaults grayed-out for reference
Save to CohortWorkoutConfig.calculations JSON via Web/app/api/cohorts/[id]/workout-config/route.ts
Display comparison: "System: 5% → Your override: 3%" for each setting
Audit log showing who changed what and when
Create calculation settings resolver at Web/lib/get-calculation-config.ts:

Function getCalculationConfig(cohortId?: string) returns merged config: if cohortId and overrides exist use cohort config, else use system defaults
Caches result 1 hour with invalidation on override changes
Used by all progression/validation logic to pull current thresholds
TypeScript types ensure config completeness
Build ExerciseDB API client in Web/lib/exercisedb.ts:

searchExercises(query, limit?) - fuzzy search with threshold 0.3
filterExercises(equipment[], muscles[], bodyParts[], limit?) - advanced filtering
getEquipmentList() - cache equipment types
getMuscleList() - cache all muscles
getBodyPartsList() - cache all body parts
getExerciseById(exerciseId) - single exercise details
inferDifficulty(exercise) - calls calculateDifficultyScore() from workout-calculations.ts
All with fetch-with-retry utility and 5-minute response cache
Error handling and fallback data
Create exercise sync system in Web/scripts/sync-exercises.ts:

Fetch priority exercises: equipment (barbell, dumbbell, kettlebell, cable, machine, resistance band, landmine, smith machine, sled), target muscles (chest, back, legs, shoulders, arms, core)
Upsert ~500-800 exercises to database with inferred difficulty field
Set lastSyncedAt timestamp per exercise
Setup monthly Vercel cron via vercel.json
Add manual "Refresh Exercise Library" button in page.tsx alongside calculation settings section
Show last sync date, exercise count, import progress
Build cohort equipment configuration in Web/app/cohorts/[id]/page.tsx:

Add "Equipment & Training" tab
Fetch equipment types from /api/v1/equipments
Multi-select checkboxes (barbell, dumbbell, kettlebell, cable, machine, resistance band, landmine, smith machine, sled, etc.)
Save to CohortWorkoutConfig.availableEquipment[] via Web/app/api/cohorts/[id]/workout-config/route.ts
Display "Last Updated" and who updated it
Create workout template builder at Web/app/coach-dashboard/templates/page.tsx (list) and Web/app/coach-dashboard/templates/[id]/page.tsx (builder):

Install @dnd-kit/core + @dnd-kit/sortable
3-column layout:
Left: Exercise library search (fuzzy search via /api/v1/exercises/search), filtered by cohort's available equipment from CohortWorkoutConfig, shows exercise cards (GIF, name, targetMuscles, difficulty badge)
Center: Drag-drop builder with exercises, each exercise card shows: sets/reps/duration/rest inputs, tempo optional, "Add Alternative" button
Right: JSON preview of template, visual rep of weekly schedule
Smart alternative suggestions from Web/app/api/exercises/alternatives/route.ts using difficulty scoring
Configure per exercise: sets (spinner), reps (spinner), duration (seconds for HIIT), rest (seconds between sets), tempo (optional), alternatives (2 max with same config)
Save to WorkoutTemplate + TemplateExercise records
Add smart alternative exercise suggestions - new Web/app/api/exercises/alternatives/route.ts:

POST endpoint: receives exerciseId + cohortId
Algorithm: find exercises with (1) same/similar equipment from cohort config, (2) 70%+ targetMuscles overlap, (3) difficulty within ±1 level (using calculateDifficultyScore())
Sort by match score (equipment match% + muscle overlap% + difficulty closeness)
Return top 3 suggestions with comparison cards (name, muscles, difficulty, equipment diff percentage)
Coach selects from suggestions or searches manually
Selected alternatives stored in TemplateExercise.alternatives[] with same sets/reps/duration/rest config as primary
Implement copy-on-assign pattern - in Web/app/clients/[id]/page.tsx Training tab:

When coach assigns template, validate scheduled date: query WorkoutAssignment for target client(s), get current calculation config via getCalculationConfig(cohortId)
If proposed date within 24h of existing scheduled workout, show warning banner: "⚠️ Client [name] has [X workouts] scheduled [dates]. Minimum [config.restDayThreshold] day rest recommended for recovery" with "Continue anyway" override button
Upon assignment: create WorkoutAssignment record(s) with frozen copy of all TemplateExercise data (exerciseId, sets, reps, duration, rest, tempo, alternatives snapshot, not just templateId)
Include assignedByCoachId, clientId, cohortId, scheduledDate, completed: false, calculationConfigVersion (current config version used for historical tracking)
Support individual assign and bulk assign to entire cohort (creates one assignment per cohort member with same date)
Update "Next Week: X Assigned, Y Completed" metric
Enable "Training" tab in Web/app/clients/[id]/page.tsx:

Remove disabled state
Build assignment UI showing:
(1) Coach's templates list (select template)
(2) Cohort/individual client selector with rest-day highlighting
(3) Date picker with color-coded rest day warnings (red = <threshold days from existing, green = ok)
(4) "Assign to entire cohort" toggle
(5) Assignment preview (exercises list, total volume estimate)
(6) Calendar view of upcoming assignments (hover shows workout summary)
(7) Metrics card "Next Week: X Assigned, Y Completed, Adherence: Z%"
Sections: "Upcoming Workouts", "Completed Workouts", "Progression" (see step 15)
Build client workout view at Web/app/client-dashboard/workouts/page.tsx:

Add "Workouts" tab to dashboard navigation
Fetch WorkoutAssignment records for logged-in client
Group by week/scheduled date
Render exercise cards with:
Hotlinked GIF (gifUrl from frozen Exercise data)
Exercise name, targetMuscles/bodyParts badges
sets × reps × duration config (e.g., "3 × 8 @ 45s rest")
Rest period countdown display (MM:SS)
Instructions array
Logging form: actualSets (spinner), actualReps (spinner), actualWeight (input), actualDuration (if timed)
"Complete Set" button updates form state, shows rest timer
"Mark Workout Complete" button creates ExerciseLog records for all exercises in assignment
Workout history shows completed date and logged metrics
Add in-app rest timer - modal component shown after "Complete Set" button:

If restSecs > 0, display countdown timer (MM:SS format)
Visual progress bar (circular or linear)
Controls: pause/resume, skip, adjust time (+15s/-15s buttons)
Audible notification (ding) when timer expires
Auto-close and ready for next set message
Improves UX for strength training adherence
Build AI progression tracking system - Web/app/api/progression/suggest/route.ts:

Trigger on ExerciseLog creation (POST handler)
Query last 2+ ExerciseLog entries for same exercise by same client
If both completed all configured sets/reps (actualSets >= targetSets AND actualReps >= targetReps) within 7 days:
Get current calculation config via getCalculationConfig(cohortId)
Determine exercise difficulty: calculateDifficultyScore() from primary exercise in assignment
Calculate suggested weight: suggestProgressiveLoad(currentWeight, difficulty, exerciseType, config)
Calculate confidence score: calculateConfidenceScore(logCount, spreadDays, consistency)
Create ProgressionSuggestion record (status: PENDING, confidenceScore, suggestedWeight)
Coach reviews in dashboard, can ACCEPT/DECLINE with reason
No auto-apply; coach always approves before weight change
Build coach analytics dashboard - in Web/app/clients/[id]/page.tsx Training tab "Progression" section:

Per-exercise progression charts: line graph of weight over time from ExerciseLog records, highlights progression suggestions
Pending suggestions panel:
Exercise name, current weight, suggested weight, confidence %, calculation used (config version + thresholds displayed)
"Accept" button (applies to this exercise for this client), "Decline" with reason field, "Ignore" (dismiss)
Batch UI: "Accept All for [Muscle Group]" to approve multiple suggestions at once (e.g., all chest exercises)
Accepted suggestions history: "3 weeks ago: Bench 50→52.5kg ✓"
Volume metrics using calculateVolumeMetric():
Total reps × weight per exercise (e.g., "Bench: 800 total reps"
Weekly volume trend (line chart, alert if exceeds maxWeeklyVolume config)
Volume per muscle group (stacked bar chart)
Adherence %: (completed vs assigned workouts) × 100
Last 4 weeks completion heatmap (calendar view with color intensity)
Rest day compliance: % of weeks with ≥1 rest day, list of at-risk clients (3+ consecutive days scheduled)
Display which thresholds apply: "System Default ⓘ" vs "Cohort Override ⓘ" (tooltips show values)
Integrate HealthKit cardio workouts from components/WorkoutCard.tsx alongside strength training
Create calculation reference UI component at Web/components/CalculationReference.tsx:

Reusable collapsible info panel showing:
Formula description and math notation
Real-world example calculation
Current threshold value (system default or cohort override)
Link to full docs at Web/docs/calculations/WORKOUT_CALCULATIONS.md
Used on admin settings page, coach settings page, analytics dashboard
Add calculation audit trail logging - extend Web/lib/audit.ts (new file if needed):

Log all WorkoutCalculationConfig changes: {userId, action: "UPDATED", field: "progressiveLoadCompound", oldValue: 5, newValue: 3, reason: "Adjust for beginner cohort", timestamp}
Create Web/docs/audit/CALCULATION_CHANGES.md auto-generated from logs
Display audit trail in admin UI ("Last 10 changes" section)
Create API routes:

Web/app/api/admin/workout-config/route.ts (GET system defaults, PUT update with admin-only auth and audit logging)
Web/app/api/cohorts/[id]/workout-config/route.ts (GET/PUT equipment + calculation overrides)
Web/app/api/exercises/route.ts (proxy to ExerciseDB search/filter with 5min cache)
Web/app/api/exercises/alternatives/route.ts (smart suggestions using difficulty scoring)
Web/app/api/workout-templates/route.ts (CRUD: GET list, POST create, PUT update, DELETE)
Web/app/api/workout-assignments/route.ts (GET by client/date range with rest-day validation, POST assign with bulk cohort + copy-on-assign logic, PUT mark complete, DELETE)
Web/app/api/exercise-logs/route.ts (POST log set completion with actualSets/Reps/Weight/Duration, auto-triggers progression check)
Web/app/api/progression/suggest/route.ts (GET list pending for coach, POST accept/decline/ignore with batch muscle-group support)
Further Considerations
Calculation versioning - Store calculationConfigVersion on ExerciseLog to track which config was used for historical accuracy when formulas change. Display "Recalculate with current settings" button for coaches (optional archive history).

Individual client overrides - Phase 2: add ClientWorkoutCalculationConfig table for per-client custom thresholds (e.g., conservative 3% load for injury recovery).

Difficulty metadata completeness - If ExerciseDB doesn't provide explicit difficulty, inference algorithm fills gap. Build coach UI to manually override/tweak difficulty on first template build, store override in database.
