/**
 * System settings utilities
 * Provides centralized access to configurable system parameters
 */

import { db } from "@/lib/db"
import {
  DEFAULT_DATA_PROCESSING_HTML,
  DEFAULT_PRIVACY_HTML,
  DEFAULT_TERMS_HTML,
} from "@/lib/legal-content"

export interface SystemSettings {
  maxClientsPerCoach: number
  minClientsPerCoach: number
  recentActivityDays: number
  lowEngagementEntries: number
  noActivityDays: number
  criticalNoActivityDays: number
  shortTermWindowDays: number
  longTermWindowDays: number
  adminOverrideEmail: string | null
  healthkitEnabled: boolean
  iosIntegrationEnabled: boolean
  adherenceGreenMinimum: number
  adherenceAmberMinimum: number
  bodyFatLowPercent: number
  bodyFatMediumPercent: number
  bodyFatHighPercent: number
  bodyFatVeryHighPercent: number
  minDailyCalories: number
  maxDailyCalories: number
  minProteinPerLb: number
  maxProteinPerLb: number
  defaultCarbsPercent: number
  defaultProteinPercent: number
  defaultFatPercent: number
  stepsNotMuch: number
  stepsLight: number
  stepsModerate: number
  stepsHeavy: number
  workoutNotMuch: number
  workoutLight: number
  workoutModerate: number
  workoutHeavy: number
  showPersonalizedPlan: boolean
  termsContentHtml: string
  privacyContentHtml: string
  dataProcessingContentHtml: string
}

// Default values (fallback if database settings not found)
const DEFAULT_SETTINGS: SystemSettings = {
  maxClientsPerCoach: 50,
  minClientsPerCoach: 10,
  recentActivityDays: 14,
  lowEngagementEntries: 7,
  noActivityDays: 14,
  criticalNoActivityDays: 30,
  shortTermWindowDays: 7,
  longTermWindowDays: 30,
  adminOverrideEmail: null,
  healthkitEnabled: true,
  iosIntegrationEnabled: true,
  adherenceGreenMinimum: 6,
  adherenceAmberMinimum: 3,
  bodyFatLowPercent: 12.5,
  bodyFatMediumPercent: 20.0,
  bodyFatHighPercent: 30.0,
  bodyFatVeryHighPercent: 37.5,
  minDailyCalories: 1000,
  maxDailyCalories: 5000,
  minProteinPerLb: 0.4,
  maxProteinPerLb: 2.0,
  defaultCarbsPercent: 40,
  defaultProteinPercent: 30,
  defaultFatPercent: 30,
  stepsNotMuch: 5000,
  stepsLight: 7500,
  stepsModerate: 10000,
  stepsHeavy: 12500,
  workoutNotMuch: 75,
  workoutLight: 150,
  workoutModerate: 225,
  workoutHeavy: 300,
  showPersonalizedPlan: true,
  termsContentHtml: DEFAULT_TERMS_HTML,
  privacyContentHtml: DEFAULT_PRIVACY_HTML,
  dataProcessingContentHtml: DEFAULT_DATA_PROCESSING_HTML,
}

/**
 * Get current system settings from database
 * Falls back to defaults if not configured
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const settings = await db.systemSettings.findFirst()
    const result = settings || DEFAULT_SETTINGS

    // Runtime validation for required onboarding/plan settings
    const requiredKeys: (keyof SystemSettings)[] = [
      'minDailyCalories', 'maxDailyCalories', 'stepsNotMuch', 'stepsLight', 'stepsModerate', 'stepsHeavy'
    ]
    for (const key of requiredKeys) {
      if (result[key] === undefined || result[key] === null) {
        // eslint-disable-next-line no-console
        // console.log(`SystemSettings: Missing or misconfigured value for '${key}', using default.`)
        (result as any)[key] = (DEFAULT_SETTINGS as any)[key]
      }
    }

    return result
  } catch (error) {
    console.error("Error fetching system settings, using defaults:", error)
    return DEFAULT_SETTINGS
  }
}

/**
 * Get a specific setting value
 */
export async function getSystemSetting<K extends keyof SystemSettings>(
  key: K
): Promise<SystemSettings[K]> {
  const settings = await getSystemSettings()
  return settings[key]
}

/**
 * Feature flag helpers
 */

/**
 * Check if HealthKit features are enabled
 */
export async function isHealthKitEnabled(): Promise<boolean> {
  return await getSystemSetting("healthkitEnabled")
}

/**
 * Check if iOS integration features are enabled
 */
export async function isIOSIntegrationEnabled(): Promise<boolean> {
  return await getSystemSetting("iosIntegrationEnabled")
}
