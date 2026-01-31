import NextAuth, { type NextAuthConfig } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import CredentialsProvider from "next-auth/providers/credentials"
import { db } from "./db"
import { Role } from "./types"
import { isAdminWithOverride } from "./permissions-server"
import type { Adapter } from "next-auth/adapters"
import bcrypt from "bcryptjs"
import { randomUUID } from "crypto"

export const authOptions: NextAuthConfig = {
  adapter: PrismaAdapter(db) as Adapter,

  session: {
    strategy: "jwt",
    maxAge: 60 * 60, // 1 hour
  },

  providers: [
    // Google (optional)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),

    // Apple (optional)
    ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
      ? [
          AppleProvider({
            clientId: process.env.APPLE_CLIENT_ID!,
            clientSecret: process.env.APPLE_CLIENT_SECRET!,
          }),
        ]
      : []),

    // Email / password
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const email =
          typeof credentials.email === "string" ? credentials.email : ""
        const password =
          typeof credentials.password === "string" ? credentials.password : ""

        if (!email || !password) return null

        const user = await db.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            passwordHash: true,
            roles: true,
            isTestUser: true,
            mustChangePassword: true,
          },
        })

        if (!user || !user.passwordHash) return null

        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles as Role[],
          isTestUser: user.isTestUser,
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],

  events: {
    async createUser({ user }) {
      // Ensure default role
      await db.user.update({
        where: { id: user.id },
        data: { roles: [Role.CLIENT] },
      })

      if (!user.email) return

      try {
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          select: { isTestUser: true },
        })

        const { sendSystemEmail } = await import("./email")
        const { EMAIL_TEMPLATE_KEYS } = await import("./email-templates")
        const loginUrl = `${
          process.env.NEXTAUTH_URL || "http://localhost:3000"
        }/login`

        // Fire-and-forget: do not block auth lifecycle
        void sendSystemEmail({
          templateKey: EMAIL_TEMPLATE_KEYS.WELCOME_CLIENT,
          to: user.email,
          variables: {
            userName: user.name ? ` ${user.name}` : "",
            loginUrl,
          },
          isTestUser: dbUser?.isTestUser,
          // Fallback to inline content if template not available
          fallbackSubject: "Welcome to CoachFit",
          fallbackHtml: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #1f2937;">Welcome to CoachFit!</h2>
              <p>Hi${user.name ? ` ${user.name}` : ""},</p>
              <p>Welcome to CoachFit! We're excited to have you on board.</p>
              <p>You're all set — your coach will guide you next.</p>
              <p style="margin-top: 24px;">
                <a
                  href="${loginUrl}"
                  style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;"
                >
                  Sign in to your dashboard
                </a>
              </p>
              <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
                If you have any questions, please contact your coach.
              </p>
            </div>
          `,
          fallbackText: `Welcome to CoachFit!\n\nHi${user.name ? ` ${user.name}` : ""},\n\nWelcome to CoachFit! We're excited to have you on board.\n\nYou're all set — your coach will guide you next.\n\nSign in to your dashboard: ${loginUrl}\n\nIf you have any questions, please contact your coach.`,
        })
      } catch (error) {
        console.error("Error sending welcome email:", error)
      }
    },
  },

  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user?.email || !user?.id) return true

      try {
        // Log OAuth sign-in attempts for debugging
        if (account && account.provider !== "credentials") {
          console.log(`[AUTH] OAuth sign-in: provider=${account.provider}, email=${user.email}, userId=${user.id}`)

          // With allowDangerousEmailAccountLinking enabled on the provider,
          // NextAuth should handle account linking automatically.
          // We just need to process invites below.
        }

        // Coach invites
        const coachInvites = await db.coachInvite.findMany({
          where: { email: user.email },
        })

        if (coachInvites.length > 0) {
          const firstInvite = coachInvites[0]

          await db.user.update({
            where: { id: user.id },
            data: { invitedByCoachId: firstInvite.coachId },
          })

          await db.coachInvite.deleteMany({
            where: { email: user.email },
          })
        }

        // Cohort invites
        const cohortInvites = await db.cohortInvite.findMany({
          where: { email: user.email },
        })

        if (cohortInvites.length > 0) {
          const existingMembership = await db.cohortMembership.findFirst({
            where: { userId: user.id! },
            select: { cohortId: true },
          })

          if (existingMembership) {
            await db.cohortInvite.deleteMany({
              where: { email: user.email },
            })
          } else {
            const invite = cohortInvites[0]
            await db.$transaction(async (tx) => {
              await tx.cohortMembership.create({
                data: {
                  userId: user.id!,
                  cohortId: invite.cohortId,
                },
              })

              await tx.cohortInvite.deleteMany({
                where: { email: user.email },
              })
            })
          }
        }
      } catch (error) {
        // Log the full error with stack trace
        console.error("[AUTH] Error during sign-in callback:", error)
        if (error instanceof Error) {
          console.error("[AUTH] Error name:", error.name)
          console.error("[AUTH] Error message:", error.message)
          console.error("[AUTH] Error stack:", error.stack)
        }
        // Re-throw to trigger NextAuth error handling
        throw error
      }

      return true
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.mustChangePassword = (user as any).mustChangePassword ?? false

        // Store password change timestamp for session invalidation
        const dbUserWithPwdChange = await db.user.findUnique({
          where: { id: user.id },
          select: { passwordChangedAt: true },
        })
        token.passwordChangedAt = dbUserWithPwdChange?.passwordChangedAt?.getTime() ?? null

        if (Array.isArray(user.roles) && user.roles.length > 0) {
          token.roles = user.roles
          token.isTestUser = user.isTestUser ?? false
          token.isOnboardingComplete =
            (user as any).isOnboardingComplete ?? (user as any).onboardingComplete ?? false
        } else {
          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { roles: true, isTestUser: true, onboardingComplete: true, mustChangePassword: true },
          })

          token.roles = dbUser?.roles ?? [Role.CLIENT]
          token.isTestUser = dbUser?.isTestUser ?? false
          token.isOnboardingComplete = dbUser?.onboardingComplete ?? false
          token.mustChangePassword = dbUser?.mustChangePassword ?? token.mustChangePassword ?? false
        }
      }

      // Check if password was changed after token was issued (invalidate session)
      if (token.id && token.passwordChangedAt) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { passwordChangedAt: true },
        })

        const currentPasswordChangedAt = dbUser?.passwordChangedAt?.getTime() ?? null

        // If password was changed after the token was created, invalidate the session
        if (currentPasswordChangedAt && currentPasswordChangedAt > (token.passwordChangedAt as number)) {
          // Return an empty token to effectively invalidate the session
          return {} as typeof token
        }
      }

      if (token.adminOverride === undefined && token.email) {
        const roles = (token.roles as Role[]) ?? [Role.CLIENT]
        const hasOverrideAdmin = await isAdminWithOverride({
          roles,
          email: token.email as string,
        })

        token.adminOverride = hasOverrideAdmin
        if (hasOverrideAdmin && !roles.includes(Role.ADMIN)) {
          token.roles = [...roles, Role.ADMIN]
        }
      } else if (token.adminOverride && token.roles && !(token.roles as Role[]).includes(Role.ADMIN)) {
        token.roles = [...(token.roles as Role[]), Role.ADMIN]
      }

      if (token.id && (token.mustChangePassword === undefined || token.mustChangePassword === true)) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          select: { mustChangePassword: true },
        })
        token.mustChangePassword = dbUser?.mustChangePassword ?? false
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.roles = (token.roles as Role[]) ?? [Role.CLIENT]
        session.user.isTestUser = token.isTestUser as boolean
        ;(session.user as any).isOnboardingComplete = token.isOnboardingComplete as boolean
        ;(session.user as any).mustChangePassword = token.mustChangePassword as boolean
      }

      return session
    },
  },

  pages: {
    signIn: "/login",
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
