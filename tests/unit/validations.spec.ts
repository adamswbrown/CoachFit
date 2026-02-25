import { describe, it, expect } from 'vitest'
import {
  upsertEntrySchema,
  createCohortSchema,
  addClientToCohortSchema,
  signupSchema,
  passwordSchema,
  userPreferenceSchema,
  questionnaireBundleSchema,
  weeklyQuestionnaireResponseSchema,
} from '../../lib/validations'

// ==================== Entry Schema ====================

describe('upsertEntrySchema', () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  it('accepts valid entry with all fields', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      steps: 10000,
      calories: 2200,
      sleepQuality: 7,
      perceivedStress: 5,
      notes: 'Good day',
      date: yesterdayStr,
    })).not.toThrow()
  })

  it('accepts entry with only required fields', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      perceivedStress: 5,
      date: yesterdayStr,
    })).not.toThrow()
  })

  it('rejects zero weight', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 0,
      perceivedStress: 5,
      date: yesterdayStr,
    })).toThrow()
  })

  it('rejects negative weight', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: -10,
      perceivedStress: 5,
      date: yesterdayStr,
    })).toThrow()
  })

  it('rejects weight over 1000', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 1001,
      perceivedStress: 5,
      date: yesterdayStr,
    })).toThrow()
  })

  it('rejects negative steps', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      steps: -1,
      perceivedStress: 5,
      date: yesterdayStr,
    })).toThrow()
  })

  it('rejects steps over 100000', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      steps: 100001,
      perceivedStress: 5,
      date: yesterdayStr,
    })).toThrow()
  })

  it('rejects negative calories', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      calories: -100,
      perceivedStress: 5,
      date: yesterdayStr,
    })).toThrow()
  })

  it('rejects calories over 20000', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      calories: 20001,
      perceivedStress: 5,
      date: yesterdayStr,
    })).toThrow()
  })

  it('rejects sleep quality below 1', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      sleepQuality: 0,
      perceivedStress: 5,
      date: yesterdayStr,
    })).toThrow()
  })

  it('rejects sleep quality above 10', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      sleepQuality: 11,
      perceivedStress: 5,
      date: yesterdayStr,
    })).toThrow()
  })

  it('rejects perceived stress below 1', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      perceivedStress: 0,
      date: yesterdayStr,
    })).toThrow()
  })

  it('rejects perceived stress above 10', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      perceivedStress: 11,
      date: yesterdayStr,
    })).toThrow()
  })

  it('rejects notes over 2000 characters', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      perceivedStress: 5,
      notes: 'x'.repeat(2001),
      date: yesterdayStr,
    })).toThrow()
  })

  it('rejects future dates', () => {
    const future = new Date()
    future.setDate(future.getDate() + 2)
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      perceivedStress: 5,
      date: future.toISOString().slice(0, 10),
    })).toThrow()
  })

  it('rejects invalid date strings', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      perceivedStress: 5,
      date: 'not-a-date',
    })).toThrow()
  })

  it('accepts today as a valid date', () => {
    const today = new Date().toISOString().slice(0, 10)
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      perceivedStress: 5,
      date: today,
    })).not.toThrow()
  })

  it('accepts custom responses as JSON object', () => {
    expect(() => upsertEntrySchema.parse({
      weightLbs: 180,
      perceivedStress: 5,
      date: yesterdayStr,
      customResponses: { mood: 'great', energy: 8 },
    })).not.toThrow()
  })
})

// ==================== Cohort Schema ====================

describe('createCohortSchema', () => {
  const validTimed = {
    name: 'Test Cohort',
    cohortStartDate: '2026-03-01',
    type: 'TIMED' as const,
    durationConfig: 'timed' as const,
    durationWeeks: 6,
  }

  it('accepts valid TIMED cohort', () => {
    expect(() => createCohortSchema.parse(validTimed)).not.toThrow()
  })

  it('rejects empty name', () => {
    expect(() => createCohortSchema.parse({ ...validTimed, name: '' })).toThrow()
  })

  it('rejects name over 255 characters', () => {
    expect(() => createCohortSchema.parse({ ...validTimed, name: 'x'.repeat(256) })).toThrow()
  })

  it('rejects invalid start date', () => {
    expect(() => createCohortSchema.parse({ ...validTimed, cohortStartDate: 'not-a-date' })).toThrow()
  })

  it('accepts ONGOING cohort with membership duration', () => {
    expect(() => createCohortSchema.parse({
      name: 'Ongoing Cohort',
      cohortStartDate: '2026-03-01',
      type: 'ONGOING',
      durationConfig: 'ongoing',
      membershipDurationMonths: 6,
    })).not.toThrow()
  })

  it('rejects ONGOING cohort without membership duration', () => {
    expect(() => createCohortSchema.parse({
      name: 'Ongoing Cohort',
      cohortStartDate: '2026-03-01',
      type: 'ONGOING',
      durationConfig: 'ongoing',
    })).toThrow()
  })

  it('rejects ONGOING cohort with durationWeeks', () => {
    expect(() => createCohortSchema.parse({
      name: 'Ongoing Cohort',
      cohortStartDate: '2026-03-01',
      type: 'ONGOING',
      durationConfig: 'ongoing',
      membershipDurationMonths: 6,
      durationWeeks: 12,
    })).toThrow()
  })

  it('accepts CHALLENGE cohort with valid duration (6, 8, or 12 weeks)', () => {
    for (const weeks of [6, 8, 12]) {
      expect(() => createCohortSchema.parse({
        name: 'Challenge',
        cohortStartDate: '2026-03-01',
        type: 'CHALLENGE',
        durationConfig: 'challenge',
        durationWeeks: weeks,
      })).not.toThrow()
    }
  })

  it('rejects CHALLENGE cohort with invalid duration', () => {
    expect(() => createCohortSchema.parse({
      name: 'Challenge',
      cohortStartDate: '2026-03-01',
      type: 'CHALLENGE',
      durationConfig: 'challenge',
      durationWeeks: 10,
    })).toThrow()
  })

  it('rejects TIMED cohort without durationWeeks', () => {
    expect(() => createCohortSchema.parse({
      name: 'Timed',
      cohortStartDate: '2026-03-01',
      type: 'TIMED',
      durationConfig: 'timed',
    })).toThrow()
  })

  it('accepts CUSTOM cohort with customCohortTypeId', () => {
    expect(() => createCohortSchema.parse({
      name: 'Custom Cohort',
      cohortStartDate: '2026-03-01',
      type: 'CUSTOM',
      durationConfig: 'custom',
      durationWeeks: 8,
      customCohortTypeId: '550e8400-e29b-41d4-a716-446655440000',
    })).not.toThrow()
  })

  it('accepts CUSTOM cohort with customTypeLabel', () => {
    expect(() => createCohortSchema.parse({
      name: 'Custom Cohort',
      cohortStartDate: '2026-03-01',
      type: 'CUSTOM',
      durationConfig: 'custom',
      durationWeeks: 8,
      customTypeLabel: 'My Custom Type',
    })).not.toThrow()
  })

  it('rejects CUSTOM cohort without custom type identifier', () => {
    expect(() => createCohortSchema.parse({
      name: 'Custom Cohort',
      cohortStartDate: '2026-03-01',
      type: 'CUSTOM',
      durationConfig: 'custom',
      durationWeeks: 8,
    })).toThrow()
  })

  it('rejects non-ONGOING cohort with membershipDurationMonths', () => {
    expect(() => createCohortSchema.parse({
      ...validTimed,
      membershipDurationMonths: 6,
    })).toThrow()
  })

  it('accepts optional co-coaches', () => {
    expect(() => createCohortSchema.parse({
      ...validTimed,
      coCoaches: ['coach1@example.com', 'coach2@example.com'],
    })).not.toThrow()
  })

  it('rejects invalid co-coach emails', () => {
    expect(() => createCohortSchema.parse({
      ...validTimed,
      coCoaches: ['not-an-email'],
    })).toThrow()
  })

  it('accepts optional check-in config', () => {
    expect(() => createCohortSchema.parse({
      ...validTimed,
      checkInConfig: {
        enabledPrompts: ['weight', 'steps'],
        customPrompt1: 'How are you feeling?',
        customPrompt1Type: 'text',
      },
    })).not.toThrow()
  })
})

// ==================== Add Client to Cohort Schema ====================

describe('addClientToCohortSchema', () => {
  it('accepts valid email', () => {
    expect(() => addClientToCohortSchema.parse({ email: 'test@example.com' })).not.toThrow()
  })

  it('rejects invalid email', () => {
    expect(() => addClientToCohortSchema.parse({ email: 'not-an-email' })).toThrow()
  })

  it('rejects empty string', () => {
    expect(() => addClientToCohortSchema.parse({ email: '' })).toThrow()
  })
})

// ==================== Password Schema ====================

describe('passwordSchema', () => {
  it('accepts strong password', () => {
    expect(() => passwordSchema.parse('MyStr0ngP@ss!')).not.toThrow()
  })

  it('rejects password shorter than 12 characters', () => {
    expect(() => passwordSchema.parse('Short1@a')).toThrow()
  })

  it('rejects password without uppercase', () => {
    expect(() => passwordSchema.parse('alllowercase1@')).toThrow()
  })

  it('rejects password without lowercase', () => {
    expect(() => passwordSchema.parse('ALLUPPERCASE1@')).toThrow()
  })

  it('rejects password without number', () => {
    expect(() => passwordSchema.parse('NoNumbersHere@!')).toThrow()
  })

  it('rejects password without special character', () => {
    expect(() => passwordSchema.parse('NoSpecialChar1A')).toThrow()
  })

  it('accepts password with exactly 12 characters', () => {
    expect(() => passwordSchema.parse('Abcdefgh1@23')).not.toThrow()
  })
})

// ==================== Signup Schema ====================

describe('signupSchema', () => {
  it('accepts valid signup', () => {
    expect(() => signupSchema.parse({
      email: 'user@example.com',
    })).not.toThrow()
  })

  it('accepts signup with optional name', () => {
    expect(() => signupSchema.parse({
      email: 'user@example.com',
      name: 'John Doe',
    })).not.toThrow()
  })

  it('rejects .local email domain', () => {
    expect(() => signupSchema.parse({
      email: 'user@test.local',
    })).toThrow()
  })

  it('rejects .test email domain', () => {
    expect(() => signupSchema.parse({
      email: 'user@something.test',
    })).toThrow()
  })

  it('rejects .example email domain', () => {
    expect(() => signupSchema.parse({
      email: 'user@foo.example',
    })).toThrow()
  })

  it('rejects .invalid email domain', () => {
    expect(() => signupSchema.parse({
      email: 'user@something.invalid',
    })).toThrow()
  })

  it('rejects .localhost email domain', () => {
    expect(() => signupSchema.parse({
      email: 'user@app.localhost',
    })).toThrow()
  })

  it('rejects invalid email format', () => {
    expect(() => signupSchema.parse({
      email: 'not-an-email',
    })).toThrow()
  })
})

// ==================== User Preference Schema ====================

describe('userPreferenceSchema', () => {
  it('accepts valid preferences', () => {
    expect(() => userPreferenceSchema.parse({
      weightUnit: 'lbs',
      measurementUnit: 'inches',
      dateFormat: 'MM/dd/yyyy',
    })).not.toThrow()
  })

  it('accepts metric preferences', () => {
    expect(() => userPreferenceSchema.parse({
      weightUnit: 'kg',
      measurementUnit: 'cm',
      dateFormat: 'dd/MM/yyyy',
    })).not.toThrow()
  })

  it('rejects invalid weight unit', () => {
    expect(() => userPreferenceSchema.parse({
      weightUnit: 'stones',
      measurementUnit: 'inches',
      dateFormat: 'MM/dd/yyyy',
    })).toThrow()
  })

  it('accepts all date format options', () => {
    const formats = ['MM/dd/yyyy', 'dd/MM/yyyy', 'dd-MMM-yyyy', 'yyyy-MM-dd', 'MMM dd, yyyy']
    for (const dateFormat of formats) {
      expect(() => userPreferenceSchema.parse({
        weightUnit: 'lbs',
        measurementUnit: 'inches',
        dateFormat,
      })).not.toThrow()
    }
  })
})

// ==================== Questionnaire Schemas ====================

describe('questionnaireBundleSchema', () => {
  it('accepts any bundleJson', () => {
    expect(() => questionnaireBundleSchema.parse({
      bundleJson: { pages: [{ elements: [] }] },
    })).not.toThrow()
  })
})

describe('weeklyQuestionnaireResponseSchema', () => {
  it('accepts valid response', () => {
    expect(() => weeklyQuestionnaireResponseSchema.parse({
      weekNumber: 1,
      responseJson: { q1: 'answer1' },
      status: 'completed',
    })).not.toThrow()
  })

  it('accepts in_progress status', () => {
    expect(() => weeklyQuestionnaireResponseSchema.parse({
      weekNumber: 2,
      responseJson: {},
      status: 'in_progress',
    })).not.toThrow()
  })

  it('rejects week number below 1', () => {
    expect(() => weeklyQuestionnaireResponseSchema.parse({
      weekNumber: 0,
      responseJson: {},
    })).toThrow()
  })

  it('rejects week number above 5', () => {
    expect(() => weeklyQuestionnaireResponseSchema.parse({
      weekNumber: 6,
      responseJson: {},
    })).toThrow()
  })
})
