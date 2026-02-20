import { describe, it, expect } from 'vitest'
import { onboardingStep2Schema, onboardingStep9Schema, onboardingSubmitSchema, onboardingPlanReviewSchema } from '../../lib/validations'

// Onboarding Step 2: Sex enum

describe('Onboarding Step 2 Schema', () => {
  it('accepts male, female, and prefer_not_to_say', () => {
    expect(() => onboardingStep2Schema.parse({ sex: 'male', weightUnit: 'lbs', measurementUnit: 'inches' })).not.toThrow()
    expect(() => onboardingStep2Schema.parse({ sex: 'female', weightUnit: 'lbs', measurementUnit: 'inches' })).not.toThrow()
    expect(() => onboardingStep2Schema.parse({ sex: 'prefer_not_to_say', weightUnit: 'lbs', measurementUnit: 'inches' })).not.toThrow()
  })
  it('rejects invalid sex value', () => {
    expect(() => onboardingStep2Schema.parse({ sex: 'other', weightUnit: 'lbs', measurementUnit: 'inches' })).toThrow()
  })
})

describe('Onboarding Step 9 Schema', () => {
  it('accepts all 5 activity levels', () => {
    const levels = ['sedentary', 'lightly_active', 'active', 'very_active', 'extremely_active']
    for (const level of levels) {
      expect(() => onboardingStep9Schema.parse({ activityLevel: level })).not.toThrow()
    }
  })
  it('rejects invalid activity level', () => {
    expect(() => onboardingStep9Schema.parse({ activityLevel: 'super_active' })).toThrow()
  })
})

describe('Onboarding Submit Schema', () => {
  it('does not require bodyFatRange or addBurnedCalories', () => {
    expect(() => onboardingSubmitSchema.parse({
      name: 'Test',
      sex: 'male',
      primaryGoal: 'lose_weight',
      currentWeightKg: 80,
      heightCm: 180,
      birthDate: '1990-01-01',
      targetWeightKg: 75,
      activityLevel: 'active',
      weightUnit: 'lbs',
      measurementUnit: 'inches',
      dateFormat: 'MM/dd/yyyy',
    })).not.toThrow()
  })
})

describe('Onboarding Plan Review Schema', () => {
  it('accepts only dailyCaloriesKcal and dailyStepsTarget', () => {
    expect(() => onboardingPlanReviewSchema.parse({ dailyCaloriesKcal: 2000, dailyStepsTarget: 10000 })).not.toThrow()
  })
  it('strips extra fields', () => {
    const parsed = onboardingPlanReviewSchema.parse({ dailyCaloriesKcal: 2000, proteinGrams: 100 } as any)
    expect(parsed).toEqual({ dailyCaloriesKcal: 2000 })
  })
})
