import { z } from "zod"

// Re-export HealthKit validation schemas
export * from "./validations/healthkit"

export const upsertEntrySchema = z.object({
  weightLbs: z.number().positive("Weight must be greater than 0").max(1000, "Weight must be 1000 lbs or less").optional(),
  steps: z.number().int("Steps must be an integer").nonnegative("Steps cannot be negative").max(100000, "Steps must be 100,000 or less").optional(),
  calories: z.number().int("Calories must be an integer").nonnegative("Calories cannot be negative").max(20000, "Calories must be 20,000 or less").optional(),
  sleepQuality: z.number().int("Sleep quality must be an integer").min(1, "Sleep quality must be between 1 and 10").max(10, "Sleep quality must be between 1 and 10").optional(),
  perceivedEffort: z.number().int("Perceived effort must be an integer").min(1, "Perceived effort must be between 1 and 10").max(10, "Perceived effort must be between 1 and 10").optional(),
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
}).refine(
  (data) => data.weightLbs !== undefined || data.steps !== undefined || 
            data.calories !== undefined || data.sleepQuality !== undefined ||
            data.perceivedEffort !== undefined || data.notes !== undefined ||
            data.customResponses !== undefined,
  { message: "At least one field must be provided" }
)

// Keep createEntrySchema for backward compatibility (deprecated, use upsertEntrySchema)
export const createEntrySchema = upsertEntrySchema

export const createCohortSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name must be 255 characters or less"),
  // ownerCoachId is for admins to assign a specific coach as owner
  ownerCoachId: z.string().uuid().optional(),
  // coCoaches is an array of coach emails to add as co-coaches
  coCoaches: z.array(z.string().email()).optional(),
  // Check-in configuration (optional)
  checkInConfig: z.object({
    enabledPrompts: z.array(z.string()).optional(),
    customPrompt1: z.string().optional(),
    customPrompt1Type: z.enum(["scale", "text", "number"]).optional(),
  }).optional(),
})

export const addClientToCohortSchema = z.object({
  email: z.string().email("Invalid email format"),
})

export const signupSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
})
