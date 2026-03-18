import "server-only"

import { db } from "./db"
import { Role } from "./types"

/**
 * Check if user has admin override via email.
 * Checks in order:
 * 1. Environment variable ADMIN_OVERRIDE_EMAIL
 * 2. Database SystemSettings.adminOverrideEmail
 */
async function checkAdminOverride(email: string): Promise<boolean> {
  try {
    const envOverrideEmail = process.env.ADMIN_OVERRIDE_EMAIL
    if (envOverrideEmail && envOverrideEmail.toLowerCase() === email.toLowerCase()) {
      return true
    }

    const settings = await db.systemSettings.findFirst()
    if (!settings || !settings.adminOverrideEmail) {
      return false
    }
    return settings.adminOverrideEmail.toLowerCase() === email.toLowerCase()
  } catch (error) {
    console.error("Error checking admin override:", error)
    const envOverrideEmail = process.env.ADMIN_OVERRIDE_EMAIL
    if (envOverrideEmail && envOverrideEmail.toLowerCase() === email.toLowerCase()) {
      return true
    }
    return false
  }
}

/**
 * Async version of isAdmin that also checks admin override email.
 * Server-only (database access required).
 */
export async function isAdminWithOverride(user: { roles: Role[]; email?: string | null }): Promise<boolean> {
  if (user.roles.includes(Role.ADMIN)) {
    return true
  }

  if (user.email) {
    return await checkAdminOverride(user.email)
  }

  return false
}
