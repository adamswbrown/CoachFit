import { Role } from "./types"

/**
 * Permission helpers for role-based access control.
 * Includes admin override email check for emergency/backdoor access.
 */

/**
 * ADMIN users can:
 * - See all cohorts (regardless of coachId)
 * - Assign cohorts to coaches
 * - Manage coach ↔ cohort relationships
 * 
 * Note: ADMIN does NOT replace COACH - user must have COACH role to act as coach.
 * Users can have multiple roles (e.g., COACH + ADMIN).
 * 
 * Admin override email can grant admin access even without ADMIN role.
 */
export function isAdmin(user: { roles: Role[] }): boolean {
  return user.roles.includes(Role.ADMIN)
}

/**
 * COACH users can:
 * - Create and manage their own cohorts
 * - View and manage clients in their cohorts
 * - View client entries
 */
export function isCoach(user: { roles: Role[] }): boolean {
  return user.roles.includes(Role.COACH)
}

/**
 * CLIENT users can:
 * - Submit daily entries
 * - View their own entries
 * - Access client dashboard
 */
export function isClient(user: { roles: Role[] }): boolean {
  return user.roles.includes(Role.CLIENT)
}

/**
 * Check if user has either ADMIN or COACH role.
 * Useful for routes that allow both admin and coach access.
 */
export function isAdminOrCoach(user: { roles: Role[] }): boolean {
  return isAdmin(user) || isCoach(user)
}
