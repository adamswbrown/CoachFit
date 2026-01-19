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

        const { sendTransactionalEmail } = await import("./email")
        const loginUrl = `${
          process.env.NEXTAUTH_URL || "http://localhost:3000"
        }/login`

        // Fire-and-forget: do not block auth lifecycle
        void sendTransactionalEmail({
          to: user.email,
          subject: "Welcome to CoachFit",
          html: `
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
          text: `Welcome to CoachFit!

Hi${user.name ? ` ${user.name}` : ""}

Welcome to CoachFit! We're excited to have you on board.

You're all set — your coach will guide you next.

Sign in to your dashboard: ${loginUrl}

If you have any questions, please contact your coach.`,
          isTestUser: dbUser?.isTestUser ?? false,
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
        // Handle account linking: if OAuth provider and email already exists, link instead of reject
        if (account && account.provider !== "credentials") {
          const existingUser = await db.user.findUnique({
            where: { email: user.email },
            select: { id: true },
          })

          if (existingUser && existingUser.id !== user.id) {
            // Email exists but for a different user ID from OAuth provider
            // This means we need to link the OAuth account to the existing user
            
            try {
              // First, delete the temporary user that was just created by OAuth
              await db.user.delete({
                where: { id: user.id },
              })
            } catch (deleteError) {
              // If deletion fails, that's okay - it might have been cleaned up already
              console.log("Note: Could not delete temporary user during account linking")
            }

            // Then link the OAuth account to the existing user
            await db.account.create({
              data: {
                id: randomUUID(),
                userId: existingUser.id,
                type: account.type,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: account.expires_at,
                token_type: account.token_type,
                scope: account.scope,
                id_token: account.id_token,
                session_state: account.session_state,
              },
            })

            // Update the user object so JWT callback uses the correct ID
            user.id = existingUser.id
          }
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

        for (const invite of cohortInvites) {
          await db.$transaction(async (tx) => {
            const existing = await tx.cohortMembership.findUnique({
              where: {
                userId_cohortId: {
                  userId: user.id!,
                  cohortId: invite.cohortId,
                },
              },
            })

            if (!existing) {
              await tx.cohortMembership.create({
                data: {
                  userId: user.id!,
                  cohortId: invite.cohortId,
                },
              })
            }

            await tx.cohortInvite.delete({
              where: { id: invite.id },
            })
          })
        }
      } catch (error) {
        console.error("Error processing invites on sign-in:", error)
      }

      return true
    },

    async jwt({ token, user }) {
      if (user) {
        token.id = user.id

        if (Array.isArray(user.roles) && user.roles.length > 0) {
          token.roles = user.roles
          token.isTestUser = user.isTestUser ?? false
        } else {
          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { roles: true, isTestUser: true },
          })

          token.roles = dbUser?.roles ?? [Role.CLIENT]
          token.isTestUser = dbUser?.isTestUser ?? false
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

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.roles = (token.roles as Role[]) ?? [Role.CLIENT]
        session.user.isTestUser = token.isTestUser as boolean
      }

      return session
    },
  },

  pages: {
    signIn: "/login",
  },
}

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions)
