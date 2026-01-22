import { z } from "zod"

// Re-export HealthKit validation schemas
export * from "./validations/healthkit"

export const upsertEntrySchema = z.object({
  weightLbs: z.number().positive("Weight must be greater than 0").max(1000, "Weight must be 1000 lbs or less"),
  steps: z.number().int("Steps must be an integer").nonnegative("Steps cannot be negative").max(100000, "Steps must be 100,000 or less").optional(),
  calories: z.number().int("Calories must be an integer").nonnegative("Calories cannot be negative").max(20000, "Calories must be 20,000 or less").optional(),
  sleepQuality: z.number().int("Sleep quality must be an integer").min(1, "Sleep quality must be between 1 and 10").max(10, "Sleep quality must be between 1 and 10").optional(),
  perceivedStress: z.number().int("Perceived stress must be an integer").min(1, "Perceived stress must be between 1 and 10").max(10, "Perceived stress must be between 1 and 10"),
  notes: z.string().max(2000, "Notes must be 2,000 characters or less").optional(),
  customResponses: z.record(z.string(), z.any()).optional(), // Phase 3: Custom coach prompts
  date: z.string().refine(
    (date) => {
      const dateObj = new Date(date)
      const today = new Date()
      today.setHours(23, 59, 59, 999)
      return dateObj <= today && !isNaN(dateObj.getTime())
    },
    {
      message: "Date must be a valid date and not in the future",
    }
  ),
})

// Keep createEntrySchema for backward compatibility (deprecated, use upsertEntrySchema)
export const createEntrySchema = upsertEntrySchema

export const createCohortSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name must be 255 characters or less"),
  cohortStartDate: z.string().refine(
    (date) => {
      const parsed = new Date(date)
      return !isNaN(parsed.getTime())
    },
    { message: "Start date must be a valid date" }
  ),
  // ownerCoachId is for admins to assign a specific coach as owner
  ownerCoachId: z.string().uuid().optional(),
  // coCoaches is an array of coach emails to add as co-coaches
  coCoaches: z.array(z.string().email()).optional(),
  // Duration configuration
  durationConfig: z.enum(["six-week", "custom"]).default("six-week"),
  durationWeeks: z.number().int("Duration must be a whole number").min(1, "Duration must be at least 1 week").max(52, "Duration must be at most 52 weeks").optional(),
  // Check-in configuration (optional)
  checkInConfig: z.object({
    enabledPrompts: z.array(z.string()).optional(),
    customPrompt1: z.string().optional(),
    customPrompt1Type: z.enum(["scale", "text", "number"]).optional(),
  }).optional(),
}).refine(
  (data) => {
    // If custom, durationWeeks is required
    if (data.durationConfig === "custom") {
      return data.durationWeeks !== undefined && data.durationWeeks > 0
    }
    // If six-week, durationWeeks should be 6
    return true
  },
  {
    message: "Custom cohorts must specify a duration in weeks",
    path: ["durationWeeks"],
  }
)

export const addClientToCohortSchema = z.object({
  email: z.string().email("Invalid email format"),
})

export const signupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
})

// Onboarding validation schemas
export const onboardingStep1Schema = z.object({
  name: z.string().min(1, "Name is required"),
})

export const onboardingStep2Schema = z.object({
  sex: z.enum(["male", "female"], { message: "Sex must be either male or female" }),
  weightUnit: z.enum(["lbs", "kg"]).default("lbs"),
  measurementUnit: z.enum(["inches", "cm"]).default("inches"),
})

export const onboardingStep3Schema = z.object({
  primaryGoal: z.enum(["lose_weight", "maintain_weight", "gain_weight"], {
    message: "Primary goal must be lose_weight, maintain_weight, or gain_weight",
  }),
})

export const onboardingStep4Schema = z.object({
  currentWeight: z.number().positive("Weight must be greater than 0").max(1000, "Weight must be 1000 or less"),
})

export const onboardingStep5Schema = z.object({
  height: z.number().positive("Height must be greater than 0").max(300, "Height must be 300 or less"),
})

export const onboardingStep6Schema = z.object({
  birthDate: z.string().refine(
    (date) => {
      const d = new Date(date)
      return !isNaN(d.getTime())
    },
    { message: "Invalid birth date format" }
  ),
  dateFormat: z.enum(["MM/dd/yyyy", "dd/MM/yyyy", "dd-MMM-yyyy", "yyyy-MM-dd", "MMM dd, yyyy"]).default("MM/dd/yyyy"),
})

export const onboardingStep7Schema = z.object({
  bodyFatRange: z.enum(["low", "medium", "high", "very_high"], {
    message: "Body fat range must be low, medium, high, or very_high",
  }),
})

export const onboardingStep8Schema = z.object({
  targetWeight: z.number().positive("Target weight must be greater than 0").max(1000, "Target weight must be 1000 or less"),
})

export const onboardingStep9Schema = z.object({
  activityLevel: z.enum([
    "sedentary",         // Level 1: Sedentary (Desk based job, no long walks during the week)
    "lightly_active",    // Level 2: Lightly Active (Desk based job but daily walks/ hard workouts 2+ per week)
    "active",            // Level 3: Active (A job mostly on feet e.g teacher, retail worker, postman but no exercise)
    "very_active",       // Level 4: Very Active (A job mostly on feet e.g teacher, retail worker, postman and exercises hard 3+ times per week or a manual labour job with no other exercise)
    "extremely_active"   // Level 5: Extremely Active (A manual labour job + Hard exercise 3+ times a week or athlete training 10+ times per week)
  ], {
    message: "Activity level must be one of: sedentary, lightly_active, active, very_active, extremely_active",
  }),
})

export const onboardingStep10Schema = z.object({
  addBurnedCalories: z.boolean().default(false),
})

export const onboardingPlanReviewSchema = z.object({
  dailyCaloriesKcal: z.number().int().min(500, "Daily calories must be at least 500 kcal").max(10000, "Daily calories must not exceed 10,000 kcal"),
  dailyStepsTarget: z.number().int().nonnegative().optional(),
})

export const onboardingSubmitSchema = z.object({
  name: z.string().min(1),
  sex: z.enum(["male", "female", "prefer_not_to_say"]),
  primaryGoal: z.enum(["lose_weight", "maintain_weight", "gain_weight"]),
  currentWeightKg: z.number().positive(),
  heightCm: z.number().positive(),
  birthDate: z.string(),
  // bodyFatRange removed per requirements
  targetWeightKg: z.number().positive(),
  activityLevel: z.enum([
    "sedentary",
    "lightly_active",
    "active",
    "very_active",
    "extremely_active"
  ]),
  // addBurnedCalories removed per requirements
  weightUnit: z.enum(["lbs", "kg"]).default("lbs"),
  measurementUnit: z.enum(["inches", "cm"]).default("inches"),
  dateFormat: z.enum(["MM/dd/yyyy", "dd/MM/yyyy", "dd-MMM-yyyy", "yyyy-MM-dd", "MMM dd, yyyy"]).default("MM/dd/yyyy"),
  dailyCaloriesKcal: z.number().int().optional(),
  // proteinGrams, carbGrams, fatGrams, waterIntakeMl, weeklyWorkoutMinutes removed per requirements
  dailyStepsTarget: z.number().int().optional(),
})

export const userPreferenceSchema = z.object({
  weightUnit: z.enum(["lbs", "kg"]).default("lbs"),
  measurementUnit: z.enum(["inches", "cm"]).default("inches"),
  dateFormat: z.enum(["MM/dd/yyyy", "dd/MM/yyyy", "dd-MMM-yyyy", "yyyy-MM-dd", "MMM dd, yyyy"]).default("MM/dd/yyyy"),
})

// Questionnaire validation schemas
export const questionnaireBundleSchema = z.object({
  bundleJson: z.any(), // SurveyJS JSON schema
})

export const weeklyQuestionnaireResponseSchema = z.object({
  weekNumber: z.number().int().min(1).max(5),
  responseJson: z.any(), // SurveyJS response data
  status: z.enum(["in_progress", "completed"]).optional(),
})

export const questionnaireStatusQuerySchema = z.object({
  cohortId: z.string().uuid().optional(),
  weekNumber: z.number().int().min(1).max(5).optional(),
})
