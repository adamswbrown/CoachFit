import { getSystemSettings } from "@/lib/system-settings"

/**
 * Fitness calculation utilities for onboarding
 * All calculations use metric units (kg, cm)
 * Returns values in kcal and grams
 */

/**
 * Body fat range-to-percentage conversion
 * Uses admin-configured percentages
 */
export async function bodyFatRangeToPercentage(range: string): Promise<number> {
  const settings = await getSystemSettings() as any
  
  switch (range.toLowerCase()) {
    case "low":
      return settings.bodyFatLowPercent ?? 12.5
    case "medium":
      return settings.bodyFatMediumPercent ?? 20.0
    case "high":
      return settings.bodyFatHighPercent ?? 30.0
    case "very_high":
    case "very high":
      return settings.bodyFatVeryHighPercent ?? 37.5
    default:
      return settings.bodyFatMediumPercent ?? 20.0
  }
}

/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation
 * BMR = 10*weight_kg + 6.25*height_cm - 5*age + (sex == male ? 5 : -161)
 * @param weightKg Current weight in kilograms
 * @param heightCm Height in centimeters
 * @param ageYears Age in years
 * @param sex "male" or "female"
 * @returns BMR in kcal/day
 */
/**
 * Calculate Basal Metabolic Rate using Mifflin-St Jeor equation
 * BMR = 10*weight_kg + 6.25*height_cm - 5*age + (sex == male ? 5 : -161)
 * If sex is 'prefer_not_to_say', treat as 'female' for BMR purposes.
 */
export function calculateBMR(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  sex: "male" | "female" | "prefer_not_to_say"
): number {
  // Treat 'prefer_not_to_say' as 'female' for BMR calculation
  const sexFactor = sex === "male" ? 5 : -161
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + sexFactor
  return bmr
}

/**
 * Calculate Total Daily Energy Expenditure based on activity level
 * TDEE = BMR * activity multiplier
 * @param bmr Basal Metabolic Rate (kcal/day)
 * @param activityLevel "not_much" | "light" | "moderate" | "heavy"
 * @returns TDEE in kcal/day
 */
export function calculateTDEE(
  bmr: number,
  activityLevel: "not_much" | "light" | "moderate" | "heavy"
): number {
  const multipliers: Record<string, number> = {
    not_much: 1.2,
    light: 1.375,
    moderate: 1.55,
    heavy: 1.725,
  }
  
  const multiplier = multipliers[activityLevel] || 1.2
  return bmr * multiplier
}

/**
 * Calculate daily calorie goal based on primary goal
 * @param tdee Total Daily Energy Expenditure
 * @param primaryGoal "lose_weight" | "maintain_weight" | "gain_weight"
 * @returns Daily calorie goal in kcal
 */
export function calculateCaloricGoal(
  tdee: number,
  primaryGoal: "lose_weight" | "maintain_weight" | "gain_weight"
): number {
  let calories: number

  switch (primaryGoal) {
    case "lose_weight":
      calories = tdee * 0.8
      break
    case "maintain_weight":
      calories = tdee
      break
    case "gain_weight":
      calories = tdee + 500
      break
    default:
      calories = tdee
  }

  // Round to nearest 10
  return Math.round(calories / 10) * 10
}

/**
 * Calculate macro targets based on calorie goal and preferences
 * Default split: Carbs 40%, Protein 30%, Fat 30%
 * Can be customized via settings
 * @param dailyCalories Daily calorie goal
 * @param carbsPercent Carbs percentage (default 40)
 * @param proteinPercent Protein percentage (default 30)
 * @param fatPercent Fat percentage (default 30)
 * @returns Object with macro targets in grams
 */
export async function calculateMacros(
  dailyCalories: number,
  customCarbsPercent?: number,
  customProteinPercent?: number,
  customFatPercent?: number
): Promise<{
  carbGrams: number
  proteinGrams: number
  fatGrams: number
}> {
  const settings = (await getSystemSettings()) as any

  const carbsPercent = customCarbsPercent ?? settings.defaultCarbsPercent ?? 40
  const proteinPercent = customProteinPercent ?? settings.defaultProteinPercent ?? 30
  const fatPercent = customFatPercent ?? settings.defaultFatPercent ?? 30

  // Verify percentages sum to 100
  const totalPercent = carbsPercent + proteinPercent + fatPercent
  if (Math.abs(totalPercent - 100) > 0.1) {
    throw new Error(`Macro percentages must sum to 100, got ${totalPercent}`)
  }

  // Convert percentages to grams
  // Carbs: 4 kcal/gram, Protein: 4 kcal/gram, Fat: 9 kcal/gram
  const carbGrams = Math.round((dailyCalories * (carbsPercent / 100)) / 4)
  const proteinGrams = Math.round((dailyCalories * (proteinPercent / 100)) / 4)
  const fatGrams = Math.round((dailyCalories * (fatPercent / 100)) / 9)

  return {
    carbGrams,
    proteinGrams,
    fatGrams,
  }
}

/**
 * Calculate daily water intake goal
 * Standard formula: weight_kg * 35 ml
 * @param weightKg Current weight in kilograms
 * @returns Water intake goal in milliliters
 */
export function calculateWaterGoal(weightKg: number): number {
  return Math.round(weightKg * 35)
}

/**
 * Validate calorie goal against admin-configured limits
 * @param calories Daily calorie goal
 * @param settings SystemSettings object with min/max calorie limits
 * @returns { isValid: boolean, error?: string }
 */
export async function validateCalories(calories: number): Promise<{
  isValid: boolean
  error?: string
}> {
  const settings = (await getSystemSettings()) as any
  const minCals = settings.minDailyCalories ?? 1000
  const maxCals = settings.maxDailyCalories ?? 5000

  if (calories < minCals) {
    return {
      isValid: false,
      error: `Calories must be at least ${minCals} kcal`,
    }
  }

  if (calories > maxCals) {
    return {
      isValid: false,
      error: `Calories must not exceed ${maxCals} kcal`,
    }
  }

  return { isValid: true }
}

/**
 * Validate protein target against admin-configured limits (per lb of body weight)
 * @param proteinGrams Daily protein target in grams
 * @param weightLbs Body weight in pounds
 * @returns { isValid: boolean, error?: string }
 */
export async function validateProtein(
  proteinGrams: number,
  weightLbs: number
): Promise<{
  isValid: boolean
  error?: string
}> {
  const settings = (await getSystemSettings()) as any
  const minProtein = settings.minProteinPerLb ?? 0.4
  const maxProtein = settings.maxProteinPerLb ?? 2.0
  const proteinPerLb = proteinGrams / weightLbs

  if (proteinPerLb < minProtein) {
    return {
      isValid: false,
      error: `Protein must be at least ${(minProtein * weightLbs).toFixed(1)}g (${minProtein}g per lb)`,
    }
  }

  if (proteinPerLb > maxProtein) {
    return {
      isValid: false,
      error: `Protein must not exceed ${(maxProtein * weightLbs).toFixed(1)}g (${maxProtein}g per lb)`,
    }
  }

  return { isValid: true }
}

/**
 * Calculate age from birth date
 * @param birthDate ISO date string (YYYY-MM-DD) or Date object
 * @returns Age in years
 */
export function calculateAge(birthDate: string | Date): number {
  const birth = typeof birthDate === "string" ? new Date(birthDate) : birthDate
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--
  }

  return age
}

/**
 * Calculate default daily steps target based on activity level
 * Uses admin-configured values from system settings
 * Returns recommended steps per day
 */
async function calculateDefaultStepsTarget(activityLevel: "not_much" | "light" | "moderate" | "heavy"): Promise<number> {
  const settings = (await getSystemSettings()) as any
  
  switch (activityLevel) {
    case "not_much":
      return settings.stepsNotMuch ?? 5000
    case "light":
      return settings.stepsLight ?? 7500
    case "moderate":
      return settings.stepsModerate ?? 10000
    case "heavy":
      return settings.stepsHeavy ?? 12500
    default:
      return settings.stepsModerate ?? 10000
  }
}

/**
 * Calculate default weekly workout minutes based on activity level
 * Uses admin-configured values from system settings
 * Returns recommended minutes per week
 */
async function calculateDefaultWorkoutMinutes(activityLevel: "not_much" | "light" | "moderate" | "heavy"): Promise<number> {
  const settings = (await getSystemSettings()) as any
  
  switch (activityLevel) {
    case "not_much":
      return settings.workoutNotMuch ?? 75
    case "light":
      return settings.workoutLight ?? 150
    case "moderate":
      return settings.workoutModerate ?? 225
    case "heavy":
      return settings.workoutHeavy ?? 300
    default:
      return settings.workoutLight ?? 150
  }
}

/**
 * Complete onboarding calculation
 * Takes all user inputs and returns complete profile data
 * All inputs expected in metric (kg, cm)
 */
export async function completeOnboardingCalculation(input: {
  weightKg: number
  heightCm: number
  birthDate: string | Date
  sex: "male" | "female" | "prefer_not_to_say"
  activityLevel: "not_much" | "light" | "moderate" | "heavy"
  primaryGoal: "lose_weight" | "maintain_weight" | "gain_weight"
  targetWeightKg: number
  customCarbsPercent?: number
  customProteinPercent?: number
  customFatPercent?: number
}) {
  const age = calculateAge(input.birthDate)
  // Treat 'prefer_not_to_say' as 'female' for BMR
  const bmr = calculateBMR(input.weightKg, input.heightCm, age, input.sex)
  const tdee = calculateTDEE(bmr, input.activityLevel)
  const dailyCalories = calculateCaloricGoal(tdee, input.primaryGoal)
  const macros = await calculateMacros(
    dailyCalories,
    input.customCarbsPercent,
    input.customProteinPercent,
    input.customFatPercent
  )
  const waterGoal = calculateWaterGoal(input.weightKg)
  const defaultStepsTarget = await calculateDefaultStepsTarget(input.activityLevel)
  const defaultWorkoutMinutes = await calculateDefaultWorkoutMinutes(input.activityLevel)

  return {
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    dailyCaloriesKcal: dailyCalories,
    proteinGrams: macros.proteinGrams,
    carbGrams: macros.carbGrams,
    fatGrams: macros.fatGrams,
    waterIntakeMl: waterGoal,
    dailyStepsTarget: defaultStepsTarget,
    weeklyWorkoutMinutes: defaultWorkoutMinutes,
  }
}
