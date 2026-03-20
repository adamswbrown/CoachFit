/**
 * Normalize workout type names to match HealthKit's official display names.
 *
 * HealthKit sends PascalCase enum values (e.g. "HighIntensityIntervalTraining")
 * while Apple Watch sends short names (e.g. "Hiit"). This normalizer maps all
 * variants to the names Apple uses in the Fitness app for consistency with iOS.
 */

const WORKOUT_TYPE_LABELS: Record<string, string> = {
  // HealthKit enum → Apple Fitness display name
  HighIntensityIntervalTraining: "High Intensity Interval Training",
  Hiit: "High Intensity Interval Training",
  HIIT: "High Intensity Interval Training",
  TraditionalStrengthTraining: "Traditional Strength Training",
  FunctionalStrengthTraining: "Functional Strength Training",
  MixedCardio: "Mixed Cardio",
  StairStepper: "Stair Stepper",
  SocialDance: "Social Dance",
  MindAndBody: "Mind and Body",
  CrossTraining: "Cross Training",
  PreparationAndRecovery: "Preparation and Recovery",
  CoreTraining: "Core Training",
  "Strength Training": "Traditional Strength Training",
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
  Core: "Core Training",
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
