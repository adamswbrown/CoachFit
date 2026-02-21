import { describe, it, expect } from 'vitest'
import { addDays, getNextExpectedCheckInDate, isCheckInMissed } from '../../lib/check-in-frequency'

describe('addDays', () => {
  it('adds positive days correctly', () => {
    const date = new Date('2026-01-15')
    const result = addDays(date, 7)
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-22')
  })

  it('adds zero days (returns same date)', () => {
    const date = new Date('2026-01-15')
    const result = addDays(date, 0)
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-15')
  })

  it('subtracts days with negative value', () => {
    const date = new Date('2026-01-15')
    const result = addDays(date, -3)
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-12')
  })

  it('handles month boundary correctly', () => {
    const date = new Date('2026-01-30')
    const result = addDays(date, 3)
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-02')
  })

  it('handles year boundary correctly', () => {
    const date = new Date('2025-12-30')
    const result = addDays(date, 5)
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-04')
  })

  it('does not mutate the original date', () => {
    const date = new Date('2026-01-15')
    const originalTime = date.getTime()
    addDays(date, 7)
    expect(date.getTime()).toBe(originalTime)
  })
})

describe('getNextExpectedCheckInDate', () => {
  it('returns today when no last check-in date', () => {
    const now = new Date('2026-02-21T14:00:00Z')
    const result = getNextExpectedCheckInDate(null, 7, now)
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-21')
    // Should be midnight
    expect(result.getHours()).toBe(0)
    expect(result.getMinutes()).toBe(0)
    expect(result.getSeconds()).toBe(0)
  })

  it('adds frequency days to last check-in date', () => {
    const lastCheckIn = new Date('2026-02-14')
    const result = getNextExpectedCheckInDate(lastCheckIn, 7)
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-21')
  })

  it('works with frequency of 1 day', () => {
    const lastCheckIn = new Date('2026-02-20')
    const result = getNextExpectedCheckInDate(lastCheckIn, 1)
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-21')
  })

  it('works with frequency of 30 days', () => {
    const lastCheckIn = new Date('2026-01-15')
    const result = getNextExpectedCheckInDate(lastCheckIn, 30)
    expect(result.toISOString().slice(0, 10)).toBe('2026-02-14')
  })
})

describe('isCheckInMissed', () => {
  it('returns false when now is before end of expected date', () => {
    const nextExpected = new Date('2026-02-21')
    const now = new Date('2026-02-21T12:00:00')
    expect(isCheckInMissed(nextExpected, now)).toBe(false)
  })

  it('returns false when now is at end of expected date', () => {
    const nextExpected = new Date('2026-02-21')
    const now = new Date('2026-02-21T23:59:59.999')
    expect(isCheckInMissed(nextExpected, now)).toBe(false)
  })

  it('returns true when now is after expected date', () => {
    const nextExpected = new Date('2026-02-20')
    const now = new Date('2026-02-21T00:00:00.001')
    expect(isCheckInMissed(nextExpected, now)).toBe(true)
  })

  it('returns true when days overdue', () => {
    const nextExpected = new Date('2026-02-15')
    const now = new Date('2026-02-21T12:00:00')
    expect(isCheckInMissed(nextExpected, now)).toBe(true)
  })

  it('returns false when now is before expected date', () => {
    const nextExpected = new Date('2026-02-25')
    const now = new Date('2026-02-21T12:00:00')
    expect(isCheckInMissed(nextExpected, now)).toBe(false)
  })
})
