import NextAuth, { type NextAuthConfig } from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import GoogleProvider from "next-auth/providers/google"
import AppleProvider from "next-auth/providers/apple"
import CredentialsProvider from "next-auth/providers/credentials"
import { db } from "./db"
import { Role } from "./types"
import type { Adapter } from "next-auth/adapters"
import bcrypt from "bcryptjs"

export const authOptions: NextAuthConfig = {
  adapter: PrismaAdapter(db) as Adapter,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60, // 1 hour
  },
  providers: [
    // Google Sign-In is optional - only include if all required env vars are present
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),
    // Apple Sign-In is optional - only include if all required env vars are present
    ...(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
      ? [
          AppleProvider({
            clientId: process.env.APPLE_CLIENT_ID!,
            clientSecret: process.env.APPLE_CLIENT_SECRET!,
            // Note: teamId, keyId, and privateKey may need to be in clientSecret for NextAuth v5
            // These fields are not directly supported in the provider config in v5
          }),
        ]
      : []),
    // Credentials provider for email/password authentication
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = typeof credentials.email === "string" ? credentials.email : ""
        const password = typeof credentials.password === "string" ? credentials.password : ""

        if (!email || !password) {
          return null
        }

        // Look up user by email
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

        if (!user) {
          return null
        }

        // If user has no passwordHash, they're OAuth-only - reject credentials login
        if (!user.passwordHash) {
          return null
        }

        // Verify password
        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          roles: user.roles,
          isTestUser: user.isTestUser,
        }
      },
    }),
  ],
  events: {
    async createUser({ user }) {
      // Ensure new users have CLIENT role (default is set in schema, but explicit here)
      await db.user.update({
        where: { id: user.id },
        data: { roles: [Role.CLIENT] },
      })

      // Send welcome email (non-blocking)
      if (user.email) {
        try {
          // Fetch isTestUser status for email suppression
          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { isTestUser: true },
          })

          const { sendTransactionalEmail } = await import("./email")
          const loginUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`

          await sendTransactionalEmail({
            to: user.email,
            subject: \"Welcome to CoachFit\",
            html: `
              <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">
                <h2 style=\"color: #1f2937;\">Welcome to CoachFit!</h2>
                <p>Hi${user.name ? ` ${user.name}` : \"\"},</p>
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
            text: `Welcome to CoachFit!\n\nHi${user.name ? ` ${user.name}` : \"\"},\n\nWelcome to CoachFit! We're excited to have you on board.\n\nYou're all set — your coach will guide you next.\n\nSign in to your dashboard: ${loginUrl}\n\nIf you have any questions, please contact your coach.`,
            isTestUser: dbUser?.isTestUser ?? false,
          })
        } catch (emailError) {
          // Log error but don't block user creation
          console.error("Error sending welcome email:", emailError)
        }
      }
    },
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (user?.email && user?.id) {
        try {
          // 1. Handle global CoachInvite - link user to coach
          const coachInvites = await db.coachInvite.findMany({
            where: { email: user.email },
          })

          if (coachInvites.length > 0) {
            // Take the first coach invite (user can only be linked to one coach)
            const firstInvite = coachInvites[0]
            
            // Set invitedByCoachId on the user
            await db.user.update({
              where: { id: user.id },
              data: { invitedByCoachId: firstInvite.coachId },
            })

            // Delete all coach invites for this email
            await db.coachInvite.deleteMany({
              where: { email: user.email },
            })
          }

          // 2. Handle CohortInvite - auto-assign to cohorts
          const cohortInvites = await db.cohortInvite.findMany({
            where: { email: user.email },
          })

          for (const invite of cohortInvites) {
            await db.$transaction(async (tx: any) => {
              // Check if membership already exists
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

              // Delete the cohort invite
              await tx.cohortInvite.delete({
                where: { id: invite.id },
              })
            })
          }
        } catch (error) {
          // Log error but don't block sign-in
          console.error("Error processing invites on sign-in:", error)
        }
      }
      return true
    },
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        // Use roles from user object if available (from credentials provider), otherwise fetch from database
        if (user.roles && Array.isArray(user.roles) && user.roles.length > 0) {
          token.roles = user.roles
          token.isTestUser = user.isTestUser ?? false
        } else {
          // Fetch user roles and isTestUser from database
          const dbUser = await db.user.findUnique({
            where: { id: user.id },
            select: { roles: true, isTestUser: true },
          })
          token.roles = dbUser?.roles || [Role.CLIENT]
          token.isTestUser = dbUser?.isTestUser ?? false
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
        session.user.roles = (token.roles as Role[]) || [Role.CLIENT]
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
