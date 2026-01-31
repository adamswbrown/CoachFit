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
  type: z.enum(["TIMED", "ONGOING", "CHALLENGE", "CUSTOM"]).default("TIMED"),
  customTypeLabel: z.string().max(80, "Custom type label must be 80 characters or less").optional(),
  customCohortTypeId: z.string().uuid().optional(),
  checkInFrequencyDays: z.number().int("Check-in frequency must be a whole number").min(1, "Check-in frequency must be at least 1 day").max(365, "Check-in frequency must be 365 days or less").optional(),
  // ownerCoachId is for admins to assign a specific coach as owner
  ownerCoachId: z.string().uuid().optional(),
  // coCoaches is an array of coach emails to add as co-coaches
  coCoaches: z.array(z.string().email()).optional(),
  // Duration configuration
  durationConfig: z.enum(["timed", "ongoing", "challenge", "custom"]).default("timed"),
  durationWeeks: z.number().int("Duration must be a whole number").min(1, "Duration must be at least 1 week").max(52, "Duration must be at most 52 weeks").optional(),
  membershipDurationMonths: z.union([z.literal(6), z.literal(12)]).optional(),
  // Check-in configuration (optional)
  checkInConfig: z.object({
    enabledPrompts: z.array(z.string()).optional(),
    customPrompt1: z.string().optional(),
    customPrompt1Type: z.enum(["scale", "text", "number"]).optional(),
  }).optional(),
}).superRefine((data, ctx) => {
  if (data.type === "ONGOING") {
    if (data.membershipDurationMonths !== 6 && data.membershipDurationMonths !== 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ongoing cohorts must select a 6- or 12-month membership",
        path: ["membershipDurationMonths"],
      })
    }
    if (data.durationWeeks !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Ongoing cohorts should not include a week-based duration",
        path: ["durationWeeks"],
      })
    }
    return
  }

  if (data.membershipDurationMonths !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Membership duration only applies to ongoing cohorts",
      path: ["membershipDurationMonths"],
    })
  }

  if (data.type === "CHALLENGE") {
    if (![6, 8, 12].includes(data.durationWeeks ?? -1)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Challenge cohorts must be 6, 8, or 12 weeks",
        path: ["durationWeeks"],
      })
    }
    return
  }

  if (data.type === "TIMED" || data.type === "CUSTOM") {
    if (data.durationWeeks === undefined || data.durationWeeks <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Timed and custom cohorts must specify a duration in weeks",
        path: ["durationWeeks"],
      })
    }
  }
}).refine(
  (data) => {
    if (data.type === "CUSTOM") {
      return Boolean(data.customCohortTypeId || data.customTypeLabel?.trim())
    }
    return true
  },
  {
    message: "Custom cohorts must include a custom type",
    path: ["customCohortTypeId"],
  }
)

export const addClientToCohortSchema = z.object({
  email: z.string().email("Invalid email format"),
})

// Strong password schema with complexity requirements
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character")

// Blocked email domains for security (prevents test user bypass)
const BLOCKED_EMAIL_DOMAINS = [".local", ".test", ".example", ".invalid", ".localhost"]

export const signupSchema = z.object({
  email: z
    .string()
    .email("Invalid email format")
    .refine(
      (email) => !BLOCKED_EMAIL_DOMAINS.some((domain) => email.toLowerCase().endsWith(domain)),
      "This email domain is not allowed for registration"
    ),
  password: passwordSchema,
  name: z.string().optional(),
})

// Onboarding validation schemas
export const onboardingStep1Schema = z.object({
  name: z.string().min(1, "Name is required"),
})

export const onboardingStep2Schema = z.object({
  sex: z.enum(["male", "female", "prefer_not_to_say"], { message: "Sex must be male, female, or prefer_not_to_say" }),
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
