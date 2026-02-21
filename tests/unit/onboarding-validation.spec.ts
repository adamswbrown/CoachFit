import { describe, it, expect } from 'vitest'
import {
  onboardingStep1Schema,
  onboardingStep2Schema,
  onboardingStep3Schema,
  onboardingStep4Schema,
  onboardingStep5Schema,
  onboardingStep6Schema,
  onboardingStep8Schema,
  onboardingStep9Schema,
  onboardingSubmitSchema,
  onboardingPlanReviewSchema,
} from '../../lib/validations'

describe('Onboarding Step 1 Schema (Name)', () => {
  it('accepts a valid name', () => {
    expect(() => onboardingStep1Schema.parse({ name: 'John' })).not.toThrow()
  })

  it('rejects an empty name', () => {
    expect(() => onboardingStep1Schema.parse({ name: '' })).toThrow()
  })
})

describe('Onboarding Step 2 Schema (Sex & Units)', () => {
  it('accepts male, female, and prefer_not_to_say', () => {
    expect(() => onboardingStep2Schema.parse({ sex: 'male', weightUnit: 'lbs', measurementUnit: 'inches' })).not.toThrow()
    expect(() => onboardingStep2Schema.parse({ sex: 'female', weightUnit: 'lbs', measurementUnit: 'inches' })).not.toThrow()
    expect(() => onboardingStep2Schema.parse({ sex: 'prefer_not_to_say', weightUnit: 'lbs', measurementUnit: 'inches' })).not.toThrow()
  })

  it('rejects invalid sex value', () => {
    expect(() => onboardingStep2Schema.parse({ sex: 'other', weightUnit: 'lbs', measurementUnit: 'inches' })).toThrow()
  })

  it('accepts kg and cm units', () => {
    expect(() => onboardingStep2Schema.parse({ sex: 'male', weightUnit: 'kg', measurementUnit: 'cm' })).not.toThrow()
  })

  it('rejects invalid unit values', () => {
    expect(() => onboardingStep2Schema.parse({ sex: 'male', weightUnit: 'stones', measurementUnit: 'inches' })).toThrow()
  })
})

describe('Onboarding Step 3 Schema (Primary Goal)', () => {
  it('accepts all valid goals', () => {
    expect(() => onboardingStep3Schema.parse({ primaryGoal: 'lose_weight' })).not.toThrow()
    expect(() => onboardingStep3Schema.parse({ primaryGoal: 'maintain_weight' })).not.toThrow()
    expect(() => onboardingStep3Schema.parse({ primaryGoal: 'gain_weight' })).not.toThrow()
  })

  it('rejects invalid goal', () => {
    expect(() => onboardingStep3Schema.parse({ primaryGoal: 'bulk' })).toThrow()
  })
})

describe('Onboarding Step 4 Schema (Current Weight)', () => {
  it('accepts a valid weight', () => {
    expect(() => onboardingStep4Schema.parse({ currentWeight: 180 })).not.toThrow()
  })

  it('rejects zero weight', () => {
    expect(() => onboardingStep4Schema.parse({ currentWeight: 0 })).toThrow()
  })

  it('rejects negative weight', () => {
    expect(() => onboardingStep4Schema.parse({ currentWeight: -10 })).toThrow()
  })

  it('rejects weight over 1000', () => {
    expect(() => onboardingStep4Schema.parse({ currentWeight: 1001 })).toThrow()
  })
})

describe('Onboarding Step 5 Schema (Height)', () => {
  it('accepts valid height', () => {
    expect(() => onboardingStep5Schema.parse({ height: 180 })).not.toThrow()
  })

  it('rejects zero height', () => {
    expect(() => onboardingStep5Schema.parse({ height: 0 })).toThrow()
  })

  it('rejects height over 300', () => {
    expect(() => onboardingStep5Schema.parse({ height: 301 })).toThrow()
  })
})

describe('Onboarding Step 6 Schema (Birth Date)', () => {
  it('accepts valid date string', () => {
    expect(() => onboardingStep6Schema.parse({ birthDate: '1990-01-15' })).not.toThrow()
  })

  it('rejects invalid date string', () => {
    expect(() => onboardingStep6Schema.parse({ birthDate: 'not-a-date' })).toThrow()
  })

  it('accepts all date format options', () => {
    const formats = ['MM/dd/yyyy', 'dd/MM/yyyy', 'dd-MMM-yyyy', 'yyyy-MM-dd', 'MMM dd, yyyy'] as const
    for (const dateFormat of formats) {
      expect(() => onboardingStep6Schema.parse({ birthDate: '1990-01-15', dateFormat })).not.toThrow()
    }
  })
})

describe('Onboarding Step 8 Schema (Target Weight)', () => {
  it('accepts valid target weight', () => {
    expect(() => onboardingStep8Schema.parse({ targetWeight: 160 })).not.toThrow()
  })

  it('rejects zero', () => {
    expect(() => onboardingStep8Schema.parse({ targetWeight: 0 })).toThrow()
  })

  it('rejects over 1000', () => {
    expect(() => onboardingStep8Schema.parse({ targetWeight: 1001 })).toThrow()
  })
})

describe('Onboarding Step 9 Schema (Activity Level)', () => {
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
  const validSubmit = {
    name: 'Test User',
    sex: 'male' as const,
    primaryGoal: 'lose_weight' as const,
    currentWeightKg: 80,
    heightCm: 180,
    birthDate: '1990-01-01',
    targetWeightKg: 75,
    activityLevel: 'active' as const,
    weightUnit: 'lbs' as const,
    measurementUnit: 'inches' as const,
    dateFormat: 'MM/dd/yyyy' as const,
  }

  it('accepts valid full submission', () => {
    expect(() => onboardingSubmitSchema.parse(validSubmit)).not.toThrow()
  })

  it('does not require bodyFatRange or addBurnedCalories', () => {
    expect(() => onboardingSubmitSchema.parse(validSubmit)).not.toThrow()
  })

  it('accepts optional dailyCaloriesKcal and dailyStepsTarget', () => {
    expect(() => onboardingSubmitSchema.parse({
      ...validSubmit,
      dailyCaloriesKcal: 2000,
      dailyStepsTarget: 10000,
    })).not.toThrow()
  })

  it('rejects missing required fields', () => {
    expect(() => onboardingSubmitSchema.parse({ name: 'Test' })).toThrow()
  })
})

describe('Onboarding Plan Review Schema', () => {
  it('accepts dailyCaloriesKcal and dailyStepsTarget', () => {
    expect(() => onboardingPlanReviewSchema.parse({ dailyCaloriesKcal: 2000, dailyStepsTarget: 10000 })).not.toThrow()
  })

  it('strips extra fields', () => {
    const parsed = onboardingPlanReviewSchema.parse({ dailyCaloriesKcal: 2000, proteinGrams: 100 } as any)
    expect(parsed).toEqual({ dailyCaloriesKcal: 2000 })
  })

  it('rejects calories below 500', () => {
    expect(() => onboardingPlanReviewSchema.parse({ dailyCaloriesKcal: 400 })).toThrow()
  })

  it('rejects calories above 10000', () => {
    expect(() => onboardingPlanReviewSchema.parse({ dailyCaloriesKcal: 10001 })).toThrow()
  })
})
