import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { nextCookies } from "better-auth/next-js"
import { customSession } from "better-auth/plugins"
import { createAuthMiddleware } from "better-auth/api"
import { db } from "./db"
import { Role } from "./types"
import bcrypt from "bcryptjs"
import { headers } from "next/headers"

/**
 * Better Auth configuration for CoachFit
 *
 * Replaces NextAuth.js v5 with Better Auth for more stable
 * Google OAuth and improved password auth.
 */
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustedOrigins: [
    process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000",
  ],

  database: prismaAdapter(db, {
    provider: "postgresql",
  }),

  session: {
    expiresIn: 60 * 60, // 1 hour (matches previous NextAuth config)
    updateAge: 60 * 5, // Refresh session every 5 minutes
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // Cache for 5 minutes to reduce DB queries
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: false,
    password: {
      // Use bcrypt for backward compatibility with existing password hashes
      hash: async (password: string) => {
        return bcrypt.hash(password, 12)
      },
      verify: async (data: { hash: string; password: string }) => {
        return bcrypt.compare(data.password, data.hash)
      },
    },
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      prompt: "select_account",
    },
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
    },
  },

  user: {
    additionalFields: {
      passwordHash: { type: "string", required: false },
      passwordChangedAt: { type: "date", required: false },
      mustChangePassword: { type: "boolean", defaultValue: false },
      roles: { type: "string[]", defaultValue: ["CLIENT"] },
      isTestUser: { type: "boolean", defaultValue: false },
      originalEmail: { type: "string", required: false },
      invitedByCoachId: { type: "string", required: false },
      onboardingComplete: { type: "boolean", defaultValue: false },
      gender: { type: "string", required: false },
      dateOfBirth: { type: "date", required: false },
      activityLevel: { type: "string", required: false },
      primaryGoal: { type: "string", required: false },
      checkInFrequencyDays: { type: "number", required: false },
      cronometerLinked: { type: "boolean", defaultValue: false },
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const path = ctx.path

      // Process invites after sign-in
      if (path === "/sign-in/social" || path === "/sign-in/email") {
        try {
          const newSession = (ctx.context as any).newSession
          if (!newSession?.user?.id || !newSession?.user?.email) return

          const normalizedEmail = newSession.user.email.toLowerCase().trim()
          await processInvitesForUser(newSession.user.id, normalizedEmail)
        } catch (error) {
          console.error("[AUTH] Error in post-sign-in hook:", error)
        }
      }

      // Set default CLIENT role and send welcome email on new user creation
      if (path === "/sign-up/email" || path === "/sign-in/social") {
        try {
          const newSession = (ctx.context as any).newSession
          if (!newSession?.user?.id) return

          const userId = newSession.user.id
          const userEmail = newSession.user.email

          // Set default CLIENT role if user has no roles
          const existing = await db.user.findUnique({
            where: { id: userId },
            select: { roles: true },
          })
          if (!existing?.roles || existing.roles.length === 0) {
            await db.user.update({
              where: { id: userId },
              data: { roles: [Role.CLIENT] },
            })
          }

          // Send welcome email (fire-and-forget)
          if (userEmail) {
            sendWelcomeEmail(userId, userEmail).catch((err: Error) =>
              console.error("Error sending welcome email:", err)
            )
          }
        } catch (error) {
          console.error("[AUTH] Error in post-signup hook:", error)
        }
      }
    }),
  },

  plugins: [
    customSession(async ({ user, session }) => {
      // Fetch roles and custom fields from database
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: {
          roles: true,
          isTestUser: true,
          mustChangePassword: true,
          onboardingComplete: true,
        },
      })

      let roles = (dbUser?.roles as Role[]) ?? [Role.CLIENT]

      // Check for admin override
      if (!roles.includes(Role.ADMIN) && user.email) {
        const { isAdminWithOverride } = await import("./permissions-server")
        const hasOverride = await isAdminWithOverride({
          roles,
          email: user.email,
        })
        if (hasOverride) {
          roles = [...roles, Role.ADMIN]
        }
      }

      return {
        user: {
          ...user,
          roles,
          isTestUser: dbUser?.isTestUser ?? false,
          mustChangePassword: dbUser?.mustChangePassword ?? false,
          onboardingComplete: dbUser?.onboardingComplete ?? false,
        },
        session,
      }
    }),
    nextCookies(), // Must be last plugin
  ],
})

/**
 * Process pending invites for a user (coach invites and cohort invites).
 * Called after sign-in.
 */
async function processInvitesForUser(userId: string, normalizedEmail: string) {
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

/**
 * Send welcome email to new users (fire-and-forget).
 */
async function sendWelcomeEmail(userId: string, email: string) {
  const dbUser = await db.user.findUnique({
    where: { id: userId },
    select: { isTestUser: true, name: true },
  })

  const { sendSystemEmail } = await import("./email")
  const { EMAIL_TEMPLATE_KEYS } = await import("./email-templates")
  const loginUrl = `${process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`

  void sendSystemEmail({
    templateKey: EMAIL_TEMPLATE_KEYS.WELCOME_CLIENT,
    to: email,
    variables: {
      userName: dbUser?.name ? ` ${dbUser.name}` : "",
      loginUrl,
    },
    isTestUser: dbUser?.isTestUser,
    fallbackSubject: "Welcome to CoachFit",
    fallbackHtml: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1f2937;">Welcome to CoachFit!</h2>
        <p>Hi${dbUser?.name ? ` ${dbUser.name}` : ""},</p>
        <p>Welcome to CoachFit! We're excited to have you on board.</p>
        <p>You're all set — your coach will guide you next.</p>
        <p style="margin-top: 24px;">
          <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Sign in to your dashboard
          </a>
        </p>
        <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
          If you have any questions, please contact your coach.
        </p>
      </div>
    `,
    fallbackText: `Welcome to CoachFit!\n\nHi${dbUser?.name ? ` ${dbUser.name}` : ""},\n\nWelcome to CoachFit! We're excited to have you on board.\n\nYou're all set — your coach will guide you next.\n\nSign in to your dashboard: ${loginUrl}\n\nIf you have any questions, please contact your coach.`,
  })
}

// ============================================================
// Compatibility layer: Provides same API shape as old NextAuth
// ============================================================

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
 * Drop-in replacement for the old NextAuth `auth()` function.
 * Returns the same shape: `{ user: { id, email, name, roles, isTestUser, ... } }` or `null`.
 */
export async function getSession(): Promise<AuthSession | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) return null

    const user = session.user as any

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
        roles: (user.roles as Role[]) ?? [Role.CLIENT],
        isTestUser: user.isTestUser ?? false,
        mustChangePassword: user.mustChangePassword ?? false,
        onboardingComplete: user.onboardingComplete ?? false,
      },
    }
  } catch (error) {
    console.error("[AUTH] Error getting session:", error)
    return null
  }
}
