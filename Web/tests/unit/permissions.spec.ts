import { describe, it, expect } from 'vitest'
import { isAdmin, isCoach, isClient, isAdminOrCoach } from '../../lib/permissions'
import { Role } from '../../lib/types'

describe('isAdmin', () => {
  it('returns true for user with ADMIN role', () => {
    expect(isAdmin({ roles: [Role.ADMIN] })).toBe(true)
  })

  it('returns false for user with only COACH role', () => {
    expect(isAdmin({ roles: [Role.COACH] })).toBe(false)
  })

  it('returns false for user with only CLIENT role', () => {
    expect(isAdmin({ roles: [Role.CLIENT] })).toBe(false)
  })

  it('returns true for user with multiple roles including ADMIN', () => {
    expect(isAdmin({ roles: [Role.COACH, Role.ADMIN] })).toBe(true)
  })

  it('returns false for user with empty roles', () => {
    expect(isAdmin({ roles: [] })).toBe(false)
  })

  it('returns true for user with all three roles', () => {
    expect(isAdmin({ roles: [Role.CLIENT, Role.COACH, Role.ADMIN] })).toBe(true)
  })
})

describe('isCoach', () => {
  it('returns true for user with COACH role', () => {
    expect(isCoach({ roles: [Role.COACH] })).toBe(true)
  })

  it('returns false for user with only ADMIN role', () => {
    expect(isCoach({ roles: [Role.ADMIN] })).toBe(false)
  })

  it('returns false for user with only CLIENT role', () => {
    expect(isCoach({ roles: [Role.CLIENT] })).toBe(false)
  })

  it('returns true for user with COACH + ADMIN roles', () => {
    expect(isCoach({ roles: [Role.COACH, Role.ADMIN] })).toBe(true)
  })

  it('returns false for user with empty roles', () => {
    expect(isCoach({ roles: [] })).toBe(false)
  })
})

describe('isClient', () => {
  it('returns true for user with CLIENT role', () => {
    expect(isClient({ roles: [Role.CLIENT] })).toBe(true)
  })

  it('returns false for user with only COACH role', () => {
    expect(isClient({ roles: [Role.COACH] })).toBe(false)
  })

  it('returns false for user with only ADMIN role', () => {
    expect(isClient({ roles: [Role.ADMIN] })).toBe(false)
  })

  it('returns true for user with CLIENT + COACH roles', () => {
    expect(isClient({ roles: [Role.CLIENT, Role.COACH] })).toBe(true)
  })

  it('returns false for user with empty roles', () => {
    expect(isClient({ roles: [] })).toBe(false)
  })
})

describe('isAdminOrCoach', () => {
  it('returns true for ADMIN', () => {
    expect(isAdminOrCoach({ roles: [Role.ADMIN] })).toBe(true)
  })

  it('returns true for COACH', () => {
    expect(isAdminOrCoach({ roles: [Role.COACH] })).toBe(true)
  })

  it('returns true for ADMIN + COACH', () => {
    expect(isAdminOrCoach({ roles: [Role.ADMIN, Role.COACH] })).toBe(true)
  })

  it('returns false for CLIENT only', () => {
    expect(isAdminOrCoach({ roles: [Role.CLIENT] })).toBe(false)
  })

  it('returns false for empty roles', () => {
    expect(isAdminOrCoach({ roles: [] })).toBe(false)
  })

  it('returns true for CLIENT + COACH (has coach)', () => {
    expect(isAdminOrCoach({ roles: [Role.CLIENT, Role.COACH] })).toBe(true)
  })

  it('returns true for CLIENT + ADMIN (has admin)', () => {
    expect(isAdminOrCoach({ roles: [Role.CLIENT, Role.ADMIN] })).toBe(true)
  })
})
