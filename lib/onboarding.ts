import { db } from "./db"
import { Role } from "./types"
import { isAdmin, isCoach } from "./permissions"

export type AccountOrigin = 
  | "admin-created" 
  | "coach-invited" 
  | "client-invited" 
  | "client-self-signup"

export type OnboardingState = {
  role: Role
  accountOrigin: AccountOrigin
  needsOnboarding: boolean
  hasCoach: boolean
  coachId: string | null
}

/**
 * Detects onboarding state for an authenticated user.
 * This determines:
 * - Role (ADMIN / COACH / CLIENT)
 * - Account origin (how they entered the system)
 * - Whether onboarding is needed
 * - If client, whether they have a coach
 */
export async function detectOnboardingState(userId: string): Promise<OnboardingState | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      roles: true,
      onboardingComplete: true,
      invitedByCoachId: true,
      createdAt: true,
      CohortMembership: {
        select: {
          Cohort: {
            select: {
              coachId: true,
            },
          },
        },
        take: 1,
      },
    },
  }).catch((error: unknown) => {
    console.error("Error fetching user in detectOnboardingState:", error)
    throw error
  })

  if (!user) {
    // User doesn't exist in database - likely stale session
    return null
  }

  const roles = user.roles as Role[]
  const needsOnboarding = !user.onboardingComplete

  // Determine role (priority: ADMIN > COACH > CLIENT)
  let role: Role = Role.CLIENT
  if (roles.includes(Role.ADMIN)) {
    role = Role.ADMIN
  } else if (roles.includes(Role.COACH)) {
    role = Role.COACH
  }

  // Determine account origin
  let accountOrigin: AccountOrigin = "client-self-signup"
  let hasCoach = false
  let coachId: string | null = null

  if (role === Role.ADMIN) {
    accountOrigin = "admin-created"
  } else if (role === Role.COACH) {
    // Coaches are always created by admins
    accountOrigin = "admin-created"
  } else if (role === Role.CLIENT) {
    // Check if client was invited by a coach
    if (user.invitedByCoachId) {
      accountOrigin = "coach-invited"
      hasCoach = true
      coachId = user.invitedByCoachId
    } else if (user.CohortMembership && user.CohortMembership.length > 0) {
      // Check if they're in a cohort (invited via cohort invite)
      accountOrigin = "client-invited"
      hasCoach = true
      coachId = user.CohortMembership[0]?.Cohort?.coachId || null
    } else {
      // Self-signup (no coach assigned)
      accountOrigin = "client-self-signup"
      hasCoach = false
      coachId = null
    }
  }

  return {
    role,
    accountOrigin,
    needsOnboarding,
    hasCoach,
    coachId,
  }
}

/**
 * Gets the appropriate onboarding route for a user's state
 */
export function getOnboardingRoute(state: OnboardingState): string {
  if (!state.needsOnboarding) {
    return "/dashboard" // Will redirect to appropriate dashboard
  }

  if (state.role === Role.ADMIN) {
    return "/onboarding/admin"
  } else if (state.role === Role.COACH) {
    return "/onboarding/coach"
  } else if (state.role === Role.CLIENT) {
    if (state.accountOrigin === "client-self-signup") {
      return "/onboarding/client/self-signup"
    } else {
      return "/onboarding/client/invited"
    }
  }

  return "/dashboard"
}
