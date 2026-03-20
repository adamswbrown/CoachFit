/**
 * Normalize HealthKit workout type enum names to human-readable labels.
 *
 * HealthKit sends PascalCase enum values (e.g. "HighIntensityIntervalTraining")
 * while Apple Watch sends short names (e.g. "Hiit"). This normalizer ensures
 * consistent display across all sources.
 */

const WORKOUT_TYPE_LABELS: Record<string, string> = {
  HighIntensityIntervalTraining: "HIIT",
  Hiit: "HIIT",
  HIIT: "HIIT",
  TraditionalStrengthTraining: "Strength Training",
  FunctionalStrengthTraining: "Functional Strength",
  MixedCardio: "Mixed Cardio",
  StairStepper: "Stair Stepper",
  SocialDance: "Social Dance",
  MindAndBody: "Mind & Body",
  CrossTraining: "Cross Training",
  PreparationAndRecovery: "Recovery",
  CoreTraining: "Core Training",
  "Strength Training": "Strength Training",
  "High Intensity Interval Training": "HIIT",
  Elliptical: "Elliptical",
  Cooldown: "Cooldown",
  Pilates: "Pilates",
  Rowing: "Rowing",
  Running: "Running",
  Walking: "Walking",
  Cycling: "Cycling",
  Swimming: "Swimming",
  Hiking: "Hiking",
  Yoga: "Yoga",
  Dance: "Dance",
  Tennis: "Tennis",
  Basketball: "Basketball",
  Soccer: "Soccer",
  Golf: "Golf",
  Core: "Core",
}

export function normalizeWorkoutType(type: string): string {
  // Direct match
  if (WORKOUT_TYPE_LABELS[type]) return WORKOUT_TYPE_LABELS[type]
  // Case-insensitive match
  const lower = type.toLowerCase()
  const match = Object.entries(WORKOUT_TYPE_LABELS).find(([k]) => k.toLowerCase() === lower)
  if (match) return match[1]
  // Split PascalCase into words (e.g. "SomeNewType" → "Some New Type")
  return type.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
}
