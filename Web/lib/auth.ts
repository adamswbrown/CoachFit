import { auth as clerkAuth, currentUser } from "@clerk/nextjs/server"
import { clerkClient } from "@clerk/nextjs/server"
import { db } from "./db"
import { Role } from "./types"

/**
 * Clerk-based authentication for CoachFit.
 *
 * Provides a compatibility wrapper (`getSession()`) that returns the same
 * session shape as the old NextAuth/Better Auth implementation, so API routes
 * and components don't need changes.
 */

export interface AuthSession {
  user: {
    id: string
    email: string
    name?: string | null
    image?: string | null
    roles: Role[]
    isTestUser: boolean
    mustChangePassword?: boolean
    onboardingComplete?: boolean
  }
}

/**
 * Get the current session (server-side).
 *
 * Drop-in replacement for the old `getSession()` function.
 * Returns `{ user: { id, email, name, roles, isTestUser, ... } }` or `null`.
 *
 * Flow:
 * 1. Get Clerk auth state (userId from session cookie)
 * 2. Look up the local User record by clerkId
 * 3. Return enriched session with roles and custom fields from our DB
 */
export async function getSession(): Promise<AuthSession | null> {
  try {
    const { userId } = await clerkAuth()

    if (!userId) return null

    // Look up local user by Clerk ID
    const dbUser = await db.user.findFirst({
      where: { clerkId: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        roles: true,
        isTestUser: true,
        mustChangePassword: true,
        onboardingComplete: true,
      },
    })

    if (!dbUser) {
      // User exists in Clerk but not in our DB yet (webhook may not have fired)
      // Try to get basic info from Clerk and create the user
      const clerkUser = await currentUser()
      if (!clerkUser?.emailAddresses?.[0]?.emailAddress) return null

      const email = clerkUser.emailAddresses[0].emailAddress.toLowerCase().trim()

      // Check if user already exists by email (case-insensitive) — may have been
      // created by webhook or signup route with different clerkId or casing
      const existingByEmail = await db.user.findFirst({
        where: { email },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          roles: true,
          isTestUser: true,
          mustChangePassword: true,
          onboardingComplete: true,
          clerkId: true,
        },
      })

      if (existingByEmail) {
        // Link clerkId if missing
        if (!existingByEmail.clerkId) {
          await db.user.update({
            where: { id: existingByEmail.id },
            data: { clerkId: userId },
          })
        }

        let existingRoles = (existingByEmail.roles as Role[]) ?? [Role.CLIENT]
        if (!existingRoles.includes(Role.ADMIN) && existingByEmail.email) {
          const { isAdminWithOverride } = await import("./permissions-server")
          const hasOverride = await isAdminWithOverride({
            roles: existingRoles,
            email: existingByEmail.email,
          })
          if (hasOverride) existingRoles = [...existingRoles, Role.ADMIN]
        }

        syncMetadataToClerk(userId, {
          dbId: existingByEmail.id,
          roles: existingRoles,
          isTestUser: existingByEmail.isTestUser ?? false,
          mustChangePassword: existingByEmail.mustChangePassword ?? false,
          onboardingComplete: existingByEmail.onboardingComplete ?? false,
        }).catch(() => {})

        return {
          user: {
            id: existingByEmail.id,
            email: existingByEmail.email,
            name: existingByEmail.name ?? null,
            image: existingByEmail.image ?? null,
            roles: existingRoles,
            isTestUser: existingByEmail.isTestUser ?? false,
            mustChangePassword: existingByEmail.mustChangePassword ?? false,
            onboardingComplete: existingByEmail.onboardingComplete ?? false,
          },
        }
      }

      // Create local user record
      const newUser = await db.user.create({
        data: {
          clerkId: userId,
          email,
          name: [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null,
          image: clerkUser.imageUrl || null,
          roles: [Role.CLIENT],
        },
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          roles: true,
          isTestUser: true,
          mustChangePassword: true,
          onboardingComplete: true,
        },
      })

      let newUserRoles = (newUser.roles as Role[]) ?? [Role.CLIENT]

      // Check for admin override on new users too
      if (!newUserRoles.includes(Role.ADMIN) && newUser.email) {
        const { isAdminWithOverride } = await import("./permissions-server")
        const hasOverride = await isAdminWithOverride({
          roles: newUserRoles,
          email: newUser.email,
        })
        if (hasOverride) {
          newUserRoles = [...newUserRoles, Role.ADMIN]
        }
      }

      // Sync metadata to Clerk
      syncMetadataToClerk(userId, {
        dbId: newUser.id,
        roles: newUserRoles,
        isTestUser: newUser.isTestUser ?? false,
        mustChangePassword: newUser.mustChangePassword ?? false,
        onboardingComplete: newUser.onboardingComplete ?? false,
      }).catch(() => {})

      return {
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name ?? null,
          image: newUser.image ?? null,
          roles: newUserRoles,
          isTestUser: newUser.isTestUser ?? false,
          mustChangePassword: newUser.mustChangePassword ?? false,
          onboardingComplete: newUser.onboardingComplete ?? false,
        },
      }
    }

    let roles = (dbUser.roles as Role[]) ?? [Role.CLIENT]

    // Check for admin override
    if (!roles.includes(Role.ADMIN) && dbUser.email) {
      const { isAdminWithOverride } = await import("./permissions-server")
      const hasOverride = await isAdminWithOverride({
        roles,
        email: dbUser.email,
      })
      if (hasOverride) {
        roles = [...roles, Role.ADMIN]
      }
    }

    // Sync metadata to Clerk publicMetadata (fire-and-forget) so client-side useSession() is current
    syncMetadataToClerk(userId, {
      dbId: dbUser.id,
      roles,
      isTestUser: dbUser.isTestUser ?? false,
      mustChangePassword: dbUser.mustChangePassword ?? false,
      onboardingComplete: dbUser.onboardingComplete ?? false,
    }).catch(() => {}) // silent fail — this is a best-effort sync

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name ?? null,
        image: dbUser.image ?? null,
        roles,
        isTestUser: dbUser.isTestUser ?? false,
        mustChangePassword: dbUser.mustChangePassword ?? false,
        onboardingComplete: dbUser.onboardingComplete ?? false,
      },
    }
  } catch (error) {
    console.error("[AUTH] Error getting session:", error)
    return null
  }
}

/**
 * Sync user metadata from DB to Clerk publicMetadata.
 * This keeps the client-side useSession() in sync with DB state.
 * Fire-and-forget — failures are logged but don't break auth.
 */
async function syncMetadataToClerk(
  clerkUserId: string,
  metadata: {
    dbId: string
    roles: Role[]
    isTestUser: boolean
    mustChangePassword: boolean
    onboardingComplete: boolean
  }
) {
  try {
    const { clerkClient } = await import("@clerk/nextjs/server")
    const client = await clerkClient()
    await client.users.updateUserMetadata(clerkUserId, {
      publicMetadata: metadata,
    })
  } catch (err) {
    console.error("[AUTH] Failed to sync metadata to Clerk:", err)
  }
}

/**
 * Process pending invites for a user (coach invites and cohort invites).
 * Called from the Clerk webhook after sign-in/sign-up.
 */
export async function processInvitesForUser(userId: string, normalizedEmail: string) {
  // Coach invites
  const coachInvites = await db.coachInvite.findMany({
    where: { email: normalizedEmail },
  })

  if (coachInvites.length > 0) {
    const firstInvite = coachInvites[0]
    await db.user.update({
      where: { id: userId },
      data: { invitedByCoachId: firstInvite.coachId },
    })
    await db.coachInvite.deleteMany({
      where: { email: normalizedEmail },
    })
  }

  // Cohort invites
  const cohortInvites = await db.cohortInvite.findMany({
    where: { email: normalizedEmail },
  })

  if (cohortInvites.length > 0) {
    const existingMembership = await db.cohortMembership.findFirst({
      where: { userId },
      select: { cohortId: true },
    })

    if (existingMembership) {
      await db.cohortInvite.deleteMany({
        where: { email: normalizedEmail },
      })
    } else {
      const invite = cohortInvites[0]
      await db.$transaction(async (tx) => {
        await tx.cohortMembership.create({
          data: {
            userId,
            cohortId: invite.cohortId,
          },
        })
        await tx.cohortInvite.deleteMany({
          where: { email: normalizedEmail },
        })
      })
    }
  }
}
