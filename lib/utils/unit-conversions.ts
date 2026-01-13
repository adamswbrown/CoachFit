/**
 * Unit conversion utilities for HealthKit data ingestion.
 * HealthKit sends data in metric units; CoachFit stores in imperial.
 */

// Conversion constants
const KG_TO_LBS = 2.20462
const LBS_TO_KG = 0.453592
const METERS_TO_INCHES = 39.3701
const INCHES_TO_METERS = 0.0254
const CM_TO_INCHES = 0.393701
const INCHES_TO_CM = 2.54

/**
 * Convert kilograms to pounds
 * @param kg Weight in kilograms
 * @returns Weight in pounds, rounded to 1 decimal place
 */
export function kgToLbs(kg: number): number {
  return Math.round(kg * KG_TO_LBS * 10) / 10
}

/**
 * Convert pounds to kilograms
 * @param lbs Weight in pounds
 * @returns Weight in kilograms, rounded to 1 decimal place
 */
export function lbsToKg(lbs: number): number {
  return Math.round(lbs * LBS_TO_KG * 10) / 10
}

/**
 * Convert meters to inches
 * @param meters Height in meters
 * @returns Height in inches, rounded to nearest integer
 */
export function metersToInches(meters: number): number {
  return Math.round(meters * METERS_TO_INCHES)
}

/**
 * Convert inches to meters
 * @param inches Height in inches
 * @returns Height in meters, rounded to 2 decimal places
 */
export function inchesToMeters(inches: number): number {
  return Math.round(inches * INCHES_TO_METERS * 100) / 100
}

/**
 * Convert centimeters to inches
 * @param cm Height in centimeters
 * @returns Height in inches, rounded to nearest integer
 */
export function cmToInches(cm: number): number {
  return Math.round(cm * CM_TO_INCHES)
}

/**
 * Convert inches to centimeters
 * @param inches Height in inches
 * @returns Height in centimeters, rounded to 1 decimal place
 */
export function inchesToCm(inches: number): number {
  return Math.round(inches * INCHES_TO_CM * 10) / 10
}

/**
 * Convert metric body measurements to imperial
 * @param metric Object with optional weight (kg) and height (m or cm)
 * @returns Object with weight in lbs and height in inches
 */
export function metricToImperial(metric: {
  weightKg?: number
  heightM?: number
  heightCm?: number
}): {
  weightLbs?: number
  heightInches?: number
} {
  const result: { weightLbs?: number; heightInches?: number } = {}

  if (metric.weightKg !== undefined) {
    result.weightLbs = kgToLbs(metric.weightKg)
  }

  if (metric.heightM !== undefined) {
    result.heightInches = metersToInches(metric.heightM)
  } else if (metric.heightCm !== undefined) {
    result.heightInches = cmToInches(metric.heightCm)
  }

  return result
}

/**
 * Convert imperial body measurements to metric
 * @param imperial Object with optional weight (lbs) and height (inches)
 * @returns Object with weight in kg and height in meters
 */
export function imperialToMetric(imperial: {
  weightLbs?: number
  heightInches?: number
}): {
  weightKg?: number
  heightM?: number
} {
  const result: { weightKg?: number; heightM?: number } = {}

  if (imperial.weightLbs !== undefined) {
    result.weightKg = lbsToKg(imperial.weightLbs)
  }

  if (imperial.heightInches !== undefined) {
    result.heightM = inchesToMeters(imperial.heightInches)
  }

  return result
}
