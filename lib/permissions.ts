import { Role } from "./types"
import { db } from "./db"

/**
 * Permission helpers for role-based access control.
 * Includes admin override email check for emergency/backdoor access.
 */

/**
 * Check if user has admin override via email
 * This is a backdoor/emergency access mechanism
 * 
 * Checks in order:
 * 1. Environment variable ADMIN_OVERRIDE_EMAIL (for deployment-level access)
 * 2. Database SystemSettings.adminOverrideEmail (for runtime configuration)
 */
async function checkAdminOverride(email: string): Promise<boolean> {
  try {
    // First check environment variable (deployment-level override)
    const envOverrideEmail = process.env.ADMIN_OVERRIDE_EMAIL
    if (envOverrideEmail && envOverrideEmail.toLowerCase() === email.toLowerCase()) {
      return true
    }
    
    // Then check database setting (runtime override)
    const settings = await db.systemSettings.findFirst()
    if (!settings || !settings.adminOverrideEmail) {
      return false
    }
    return settings.adminOverrideEmail.toLowerCase() === email.toLowerCase()
  } catch (error) {
    console.error("Error checking admin override:", error)
    // On database error, still check environment variable
    const envOverrideEmail = process.env.ADMIN_OVERRIDE_EMAIL
    if (envOverrideEmail && envOverrideEmail.toLowerCase() === email.toLowerCase()) {
      return true
    }
    return false
  }
}

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
 * Async version of isAdmin that also checks admin override email
 * Use this in server-side contexts where database access is available
 */
export async function isAdminWithOverride(user: { roles: Role[]; email?: string | null }): Promise<boolean> {
  // First check role
  if (user.roles.includes(Role.ADMIN)) {
    return true
  }
  
  // Then check admin override email
  if (user.email) {
    return await checkAdminOverride(user.email)
  }
  
  return false
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
