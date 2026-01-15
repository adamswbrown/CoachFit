/**
 * Calculate BMI from weight (lbs) and height (inches)
 * Formula: BMI = (weight in pounds / (height in inches)^2) * 703
 * 
 * @param weightLbs - Weight in pounds
 * @param heightInches - Height in inches
 * @returns BMI value (rounded to 1 decimal) or null if inputs invalid
 */
export function calculateBMI(weightLbs: number | null, heightInches: number | null): number | null {
  if (!weightLbs || !heightInches || weightLbs <= 0 || heightInches <= 0) {
    return null
  }
  const bmi = (weightLbs / (heightInches * heightInches)) * 703
  return Math.round(bmi * 10) / 10 // Round to 1 decimal
}