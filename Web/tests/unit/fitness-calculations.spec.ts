import { describe, it, expect } from 'vitest'
import {
  calculateBMR,
  calculateTDEE,
  calculateCaloricGoal,
  calculateWaterGoal,
  calculateAge,
} from '../../lib/calculations/fitness'

describe('calculateBMR', () => {
  // Mifflin-St Jeor: 10*weight_kg + 6.25*height_cm - 5*age + sexFactor
  // Male sexFactor = +5, Female/prefer_not_to_say sexFactor = -161

  it('calculates BMR for male correctly', () => {
    // 80kg, 180cm, 30 years, male
    // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(calculateBMR(80, 180, 30, 'male')).toBe(1780)
  })

  it('calculates BMR for female correctly', () => {
    // 60kg, 165cm, 25 years, female
    // BMR = 10*60 + 6.25*165 - 5*25 + (-161) = 600 + 1031.25 - 125 - 161 = 1345.25
    expect(calculateBMR(60, 165, 25, 'female')).toBe(1345.25)
  })

  it('treats prefer_not_to_say as female', () => {
    const femaleBMR = calculateBMR(70, 170, 30, 'female')
    const preferNotToSayBMR = calculateBMR(70, 170, 30, 'prefer_not_to_say')
    expect(preferNotToSayBMR).toBe(femaleBMR)
  })

  it('male BMR is higher than female BMR for same inputs', () => {
    const maleBMR = calculateBMR(75, 175, 30, 'male')
    const femaleBMR = calculateBMR(75, 175, 30, 'female')
    // Difference should be 5 - (-161) = 166
    expect(maleBMR - femaleBMR).toBe(166)
  })

  it('BMR decreases with age', () => {
    const young = calculateBMR(80, 180, 20, 'male')
    const old = calculateBMR(80, 180, 40, 'male')
    expect(young).toBeGreaterThan(old)
    // Difference should be 5 * (40 - 20) = 100
    expect(young - old).toBe(100)
  })

  it('BMR increases with weight', () => {
    const light = calculateBMR(60, 180, 30, 'male')
    const heavy = calculateBMR(100, 180, 30, 'male')
    expect(heavy).toBeGreaterThan(light)
    // Difference should be 10 * (100 - 60) = 400
    expect(heavy - light).toBe(400)
  })

  it('BMR increases with height', () => {
    const short = calculateBMR(80, 160, 30, 'male')
    const tall = calculateBMR(80, 190, 30, 'male')
    expect(tall).toBeGreaterThan(short)
    // Difference should be 6.25 * (190 - 160) = 187.5
    expect(tall - short).toBe(187.5)
  })
})

describe('calculateTDEE', () => {
  const baseBMR = 1800

  it('applies not_much multiplier (1.2)', () => {
    expect(calculateTDEE(baseBMR, 'not_much')).toBe(1800 * 1.2)
  })

  it('applies light multiplier (1.375)', () => {
    expect(calculateTDEE(baseBMR, 'light')).toBe(1800 * 1.375)
  })

  it('applies moderate multiplier (1.55)', () => {
    expect(calculateTDEE(baseBMR, 'moderate')).toBe(1800 * 1.55)
  })

  it('applies heavy multiplier (1.725)', () => {
    expect(calculateTDEE(baseBMR, 'heavy')).toBe(1800 * 1.725)
  })

  it('defaults to 1.2 for unknown activity level', () => {
    // TypeScript would prevent this, but testing runtime behavior
    expect(calculateTDEE(baseBMR, 'unknown' as any)).toBe(1800 * 1.2)
  })

  it('TDEE increases with activity level', () => {
    const sedentary = calculateTDEE(baseBMR, 'not_much')
    const light = calculateTDEE(baseBMR, 'light')
    const moderate = calculateTDEE(baseBMR, 'moderate')
    const heavy = calculateTDEE(baseBMR, 'heavy')

    expect(sedentary).toBeLessThan(light)
    expect(light).toBeLessThan(moderate)
    expect(moderate).toBeLessThan(heavy)
  })
})

describe('calculateCaloricGoal', () => {
  const tdee = 2500

  it('applies 20% deficit for weight loss', () => {
    const result = calculateCaloricGoal(tdee, 'lose_weight')
    // 2500 * 0.8 = 2000, rounded to nearest 10 = 2000
    expect(result).toBe(2000)
  })

  it('maintains TDEE for weight maintenance', () => {
    const result = calculateCaloricGoal(tdee, 'maintain_weight')
    expect(result).toBe(2500)
  })

  it('adds 500 calories for weight gain', () => {
    const result = calculateCaloricGoal(tdee, 'gain_weight')
    // 2500 + 500 = 3000, rounded to nearest 10 = 3000
    expect(result).toBe(3000)
  })

  it('rounds to nearest 10', () => {
    // 2333 * 0.8 = 1866.4, rounded to nearest 10 = 1870
    expect(calculateCaloricGoal(2333, 'lose_weight')).toBe(1870)
  })

  it('defaults to maintenance for unknown goal', () => {
    const result = calculateCaloricGoal(tdee, 'bulk' as any)
    expect(result).toBe(2500)
  })

  it('lose_weight always less than maintain', () => {
    for (const t of [1500, 2000, 2500, 3000]) {
      expect(calculateCaloricGoal(t, 'lose_weight')).toBeLessThan(
        calculateCaloricGoal(t, 'maintain_weight')
      )
    }
  })

  it('gain_weight always more than maintain', () => {
    for (const t of [1500, 2000, 2500, 3000]) {
      expect(calculateCaloricGoal(t, 'gain_weight')).toBeGreaterThan(
        calculateCaloricGoal(t, 'maintain_weight')
      )
    }
  })
})

describe('calculateWaterGoal', () => {
  it('calculates water goal correctly', () => {
    // 80kg * 35 = 2800ml
    expect(calculateWaterGoal(80)).toBe(2800)
  })

  it('rounds to nearest integer', () => {
    // 73kg * 35 = 2555ml
    expect(calculateWaterGoal(73)).toBe(2555)
  })

  it('handles small weights', () => {
    expect(calculateWaterGoal(40)).toBe(1400)
  })

  it('handles large weights', () => {
    expect(calculateWaterGoal(150)).toBe(5250)
  })
})

describe('calculateAge', () => {
  it('calculates age from string date', () => {
    // Use a fixed reference. The function uses new Date() internally so
    // we test based on known current behavior.
    const birthDate = '2000-01-01'
    const age = calculateAge(birthDate)
    // In February 2026, someone born Jan 1 2000 is 26
    expect(age).toBe(26)
  })

  it('calculates age from Date object', () => {
    const birthDate = new Date('2000-01-01')
    const age = calculateAge(birthDate)
    expect(age).toBe(26)
  })

  it('accounts for birthday not yet occurred this year', () => {
    // Born December 31, 2000 - in February 2026 they are 25 (birthday hasn't happened yet)
    const age = calculateAge('2000-12-31')
    expect(age).toBe(25)
  })

  it('handles same-year birth (baby)', () => {
    const age = calculateAge('2026-01-01')
    expect(age).toBe(0)
  })

  it('returns positive value for past dates', () => {
    const age = calculateAge('1950-06-15')
    expect(age).toBeGreaterThan(0)
  })
})
