import { describe, it, expect } from 'vitest'
import {
  ingestWorkoutsSchema,
  ingestSleepSchema,
  ingestStepsSchema,
  ingestProfileSchema,
  pairingCodeSchema,
  generatePairingCodeSchema,
} from '../../lib/validations/healthkit'

const validUUID = '550e8400-e29b-41d4-a716-446655440000'

// ==================== Workout Ingestion Schema ====================

describe('ingestWorkoutsSchema', () => {
  const validWorkout = {
    workout_type: 'Running',
    start_time: '2026-02-20T08:00:00Z',
    end_time: '2026-02-20T09:00:00Z',
    duration_seconds: 3600,
  }

  it('accepts valid workout batch', () => {
    expect(() => ingestWorkoutsSchema.parse({
      client_id: validUUID,
      workouts: [validWorkout],
    })).not.toThrow()
  })

  it('accepts workout with all optional fields', () => {
    expect(() => ingestWorkoutsSchema.parse({
      client_id: validUUID,
      workouts: [{
        ...validWorkout,
        calories_active: 450.5,
        distance_meters: 5000.0,
        avg_heart_rate: 145,
        max_heart_rate: 180,
        source_device: 'Apple Watch',
        metadata: { indoor: true },
      }],
    })).not.toThrow()
  })

  it('rejects invalid client_id', () => {
    expect(() => ingestWorkoutsSchema.parse({
      client_id: 'not-a-uuid',
      workouts: [validWorkout],
    })).toThrow()
  })

  it('rejects empty workouts array', () => {
    expect(() => ingestWorkoutsSchema.parse({
      client_id: validUUID,
      workouts: [],
    })).toThrow()
  })

  it('rejects more than 100 workouts', () => {
    const workouts = Array.from({ length: 101 }, () => validWorkout)
    expect(() => ingestWorkoutsSchema.parse({
      client_id: validUUID,
      workouts,
    })).toThrow()
  })

  it('rejects negative duration', () => {
    expect(() => ingestWorkoutsSchema.parse({
      client_id: validUUID,
      workouts: [{ ...validWorkout, duration_seconds: -1 }],
    })).toThrow()
  })

  it('rejects heart rate below 30', () => {
    expect(() => ingestWorkoutsSchema.parse({
      client_id: validUUID,
      workouts: [{ ...validWorkout, avg_heart_rate: 20 }],
    })).toThrow()
  })

  it('rejects heart rate above 250', () => {
    expect(() => ingestWorkoutsSchema.parse({
      client_id: validUUID,
      workouts: [{ ...validWorkout, max_heart_rate: 260 }],
    })).toThrow()
  })

  it('accepts null for optional numeric fields', () => {
    expect(() => ingestWorkoutsSchema.parse({
      client_id: validUUID,
      workouts: [{
        ...validWorkout,
        calories_active: null,
        distance_meters: null,
        avg_heart_rate: null,
        max_heart_rate: null,
      }],
    })).not.toThrow()
  })

  it('rejects invalid ISO datetime', () => {
    expect(() => ingestWorkoutsSchema.parse({
      client_id: validUUID,
      workouts: [{ ...validWorkout, start_time: '2026-02-20' }],
    })).toThrow()
  })

  it('rejects empty workout type', () => {
    expect(() => ingestWorkoutsSchema.parse({
      client_id: validUUID,
      workouts: [{ ...validWorkout, workout_type: '' }],
    })).toThrow()
  })
})

// ==================== Sleep Ingestion Schema ====================

describe('ingestSleepSchema', () => {
  const validSleep = {
    date: '2026-02-20',
    total_sleep_minutes: 480,
  }

  it('accepts valid sleep batch', () => {
    expect(() => ingestSleepSchema.parse({
      client_id: validUUID,
      sleep_records: [validSleep],
    })).not.toThrow()
  })

  it('accepts sleep with all optional fields', () => {
    expect(() => ingestSleepSchema.parse({
      client_id: validUUID,
      sleep_records: [{
        ...validSleep,
        in_bed_minutes: 540,
        awake_minutes: 30,
        asleep_core_minutes: 240,
        asleep_deep_minutes: 120,
        asleep_rem_minutes: 90,
        sleep_start: '2026-02-19T23:00:00Z',
        sleep_end: '2026-02-20T07:00:00Z',
        source_devices: ['Apple Watch'],
      }],
    })).not.toThrow()
  })

  it('rejects empty sleep_records array', () => {
    expect(() => ingestSleepSchema.parse({
      client_id: validUUID,
      sleep_records: [],
    })).toThrow()
  })

  it('rejects more than 400 sleep records', () => {
    const records = Array.from({ length: 401 }, () => validSleep)
    expect(() => ingestSleepSchema.parse({
      client_id: validUUID,
      sleep_records: records,
    })).toThrow()
  })

  it('rejects negative sleep minutes', () => {
    expect(() => ingestSleepSchema.parse({
      client_id: validUUID,
      sleep_records: [{ date: '2026-02-20', total_sleep_minutes: -1 }],
    })).toThrow()
  })

  it('rejects non-integer sleep minutes', () => {
    expect(() => ingestSleepSchema.parse({
      client_id: validUUID,
      sleep_records: [{ date: '2026-02-20', total_sleep_minutes: 480.5 }],
    })).toThrow()
  })

  it('rejects invalid date format', () => {
    expect(() => ingestSleepSchema.parse({
      client_id: validUUID,
      sleep_records: [{ date: '02/20/2026', total_sleep_minutes: 480 }],
    })).toThrow()
  })

  it('requires YYYY-MM-DD date format', () => {
    expect(() => ingestSleepSchema.parse({
      client_id: validUUID,
      sleep_records: [{ date: '2026-02-20', total_sleep_minutes: 480 }],
    })).not.toThrow()
  })
})

// ==================== Steps Ingestion Schema ====================

describe('ingestStepsSchema', () => {
  const validSteps = {
    date: '2026-02-20',
    total_steps: 10000,
  }

  it('accepts valid steps batch', () => {
    expect(() => ingestStepsSchema.parse({
      client_id: validUUID,
      steps: [validSteps],
    })).not.toThrow()
  })

  it('accepts steps with source devices', () => {
    expect(() => ingestStepsSchema.parse({
      client_id: validUUID,
      steps: [{
        ...validSteps,
        source_devices: ['iPhone', 'Apple Watch'],
      }],
    })).not.toThrow()
  })

  it('rejects negative steps', () => {
    expect(() => ingestStepsSchema.parse({
      client_id: validUUID,
      steps: [{ date: '2026-02-20', total_steps: -1 }],
    })).toThrow()
  })

  it('rejects steps over 200000', () => {
    expect(() => ingestStepsSchema.parse({
      client_id: validUUID,
      steps: [{ date: '2026-02-20', total_steps: 200001 }],
    })).toThrow()
  })

  it('rejects non-integer steps', () => {
    expect(() => ingestStepsSchema.parse({
      client_id: validUUID,
      steps: [{ date: '2026-02-20', total_steps: 10000.5 }],
    })).toThrow()
  })

  it('accepts zero steps', () => {
    expect(() => ingestStepsSchema.parse({
      client_id: validUUID,
      steps: [{ date: '2026-02-20', total_steps: 0 }],
    })).not.toThrow()
  })

  it('rejects empty steps array', () => {
    expect(() => ingestStepsSchema.parse({
      client_id: validUUID,
      steps: [],
    })).toThrow()
  })

  it('rejects more than 400 step records', () => {
    const steps = Array.from({ length: 401 }, () => validSteps)
    expect(() => ingestStepsSchema.parse({
      client_id: validUUID,
      steps,
    })).toThrow()
  })
})

// ==================== Profile Ingestion Schema ====================

describe('ingestProfileSchema', () => {
  const validMetric = {
    metric: 'weight' as const,
    value: 80.5,
    unit: 'kg' as const,
    measured_at: '2026-02-20T08:00:00Z',
  }

  it('accepts valid profile metrics', () => {
    expect(() => ingestProfileSchema.parse({
      client_id: validUUID,
      metrics: [validMetric],
    })).not.toThrow()
  })

  it('accepts all metric types', () => {
    const types = ['weight', 'height', 'body_fat_percentage', 'lean_body_mass'] as const
    for (const metric of types) {
      expect(() => ingestProfileSchema.parse({
        client_id: validUUID,
        metrics: [{ ...validMetric, metric }],
      })).not.toThrow()
    }
  })

  it('accepts all unit types', () => {
    const units = ['kg', 'lbs', 'm', 'cm', 'inches', 'percent'] as const
    for (const unit of units) {
      expect(() => ingestProfileSchema.parse({
        client_id: validUUID,
        metrics: [{ ...validMetric, unit }],
      })).not.toThrow()
    }
  })

  it('rejects zero value', () => {
    expect(() => ingestProfileSchema.parse({
      client_id: validUUID,
      metrics: [{ ...validMetric, value: 0 }],
    })).toThrow()
  })

  it('rejects negative value', () => {
    expect(() => ingestProfileSchema.parse({
      client_id: validUUID,
      metrics: [{ ...validMetric, value: -10 }],
    })).toThrow()
  })

  it('rejects empty metrics array', () => {
    expect(() => ingestProfileSchema.parse({
      client_id: validUUID,
      metrics: [],
    })).toThrow()
  })

  it('rejects more than 50 metrics', () => {
    const metrics = Array.from({ length: 51 }, () => validMetric)
    expect(() => ingestProfileSchema.parse({
      client_id: validUUID,
      metrics,
    })).toThrow()
  })
})

// ==================== Pairing Code Schema ====================

describe('pairingCodeSchema', () => {
  it('accepts valid 8-character pairing code', () => {
    expect(() => pairingCodeSchema.parse({ code: 'ABCD2345' })).not.toThrow()
  })

  it('rejects code shorter than 8 characters', () => {
    expect(() => pairingCodeSchema.parse({ code: 'ABC1234' })).toThrow()
  })

  it('rejects code longer than 8 characters', () => {
    expect(() => pairingCodeSchema.parse({ code: 'ABCD23456' })).toThrow()
  })

  it('rejects code with ambiguous characters (0, 1, I, O)', () => {
    // Regex [A-HJ-NP-Z2-9] excludes: 0, 1, I, O
    expect(() => pairingCodeSchema.parse({ code: '0BCDEFGH' })).toThrow() // 0
    expect(() => pairingCodeSchema.parse({ code: '1BCDEFGH' })).toThrow() // 1
    expect(() => pairingCodeSchema.parse({ code: 'IBCDEFGH' })).toThrow() // I
    expect(() => pairingCodeSchema.parse({ code: 'OBCDEFGH' })).toThrow() // O
  })

  it('accepts allowed characters including L', () => {
    // L is allowed in the character set [A-HJ-NP-Z2-9]
    expect(() => pairingCodeSchema.parse({ code: 'LBCDEFGH' })).not.toThrow()
  })
})

describe('generatePairingCodeSchema', () => {
  it('accepts valid generation request', () => {
    expect(() => generatePairingCodeSchema.parse({
      client_id: validUUID,
    })).not.toThrow()
  })

  it('accepts regenerate flag', () => {
    expect(() => generatePairingCodeSchema.parse({
      client_id: validUUID,
      regenerate: true,
    })).not.toThrow()
  })

  it('defaults regenerate to false', () => {
    const parsed = generatePairingCodeSchema.parse({ client_id: validUUID })
    expect(parsed.regenerate).toBe(false)
  })

  it('rejects invalid UUID', () => {
    expect(() => generatePairingCodeSchema.parse({
      client_id: 'not-a-uuid',
    })).toThrow()
  })
})
