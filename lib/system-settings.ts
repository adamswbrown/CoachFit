/**
 * System settings utilities
 * Provides centralized access to configurable system parameters
 */

import { db } from "@/lib/db"

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
}

/**
 * Get current system settings from database
 * Falls back to defaults if not configured
 */
export async function getSystemSettings(): Promise<SystemSettings> {
  try {
    const settings = await db.systemSettings.findFirst()
    if (!settings) {
      // Create default settings if they don't exist
      await db.systemSettings.create({ data: DEFAULT_SETTINGS })
      return DEFAULT_SETTINGS
    }
    return settings
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
