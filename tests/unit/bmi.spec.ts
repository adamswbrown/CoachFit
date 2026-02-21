import { describe, it, expect } from 'vitest'
import { calculateBMI } from '../../lib/bmi'

describe('calculateBMI', () => {
  it('calculates BMI correctly for normal weight', () => {
    // 150 lbs, 70 inches (5'10") => BMI ~21.5
    const bmi = calculateBMI(150, 70)
    expect(bmi).toBe(21.5)
  })

  it('calculates BMI correctly for overweight', () => {
    // 200 lbs, 70 inches => BMI ~28.7
    const bmi = calculateBMI(200, 70)
    expect(bmi).toBe(28.7)
  })

  it('calculates BMI correctly for underweight', () => {
    // 110 lbs, 70 inches => BMI ~15.8
    const bmi = calculateBMI(110, 70)
    expect(bmi).toBe(15.8)
  })

  it('returns null for null weight', () => {
    expect(calculateBMI(null, 70)).toBeNull()
  })

  it('returns null for null height', () => {
    expect(calculateBMI(150, null)).toBeNull()
  })

  it('returns null for both null', () => {
    expect(calculateBMI(null, null)).toBeNull()
  })

  it('returns null for zero weight', () => {
    expect(calculateBMI(0, 70)).toBeNull()
  })

  it('returns null for zero height', () => {
    expect(calculateBMI(150, 0)).toBeNull()
  })

  it('returns null for negative weight', () => {
    expect(calculateBMI(-150, 70)).toBeNull()
  })

  it('returns null for negative height', () => {
    expect(calculateBMI(150, -70)).toBeNull()
  })

  it('rounds to one decimal place', () => {
    // Verify result has at most one decimal place
    const bmi = calculateBMI(155, 68)
    expect(bmi).not.toBeNull()
    const decimalPart = String(bmi).split('.')[1]
    expect(!decimalPart || decimalPart.length <= 1).toBe(true)
  })

  it('uses correct formula: (weight / height^2) * 703', () => {
    const weight = 180
    const height = 72
    const expected = Math.round(((weight / (height * height)) * 703) * 10) / 10
    expect(calculateBMI(weight, height)).toBe(expected)
  })
})
