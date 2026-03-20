import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { signupSchema } from "@/lib/validations"
import { sendSystemEmail } from "@/lib/email"
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates"
import { Role } from "@/lib/types"
import { z } from "zod"

const TEMP_PASSWORD_LENGTH = 16
const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz"
const NUMBERS = "23456789"
const SPECIAL = "!@#$%^&*()-_=+[]{}"

const signupConsentSchema = z.object({
  termsAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
  dataProcessing: z.literal(true),
  marketing: z.boolean().optional(),
})

function randomIndex(max: number): number {
  const buffer = new Uint32Array(1)
  crypto.getRandomValues(buffer)
  return (buffer[0] as number) % max
}

function pickRandomChar(charset: string): string {
  return charset[randomIndex(charset.length)] ?? ""
}

function shuffleChars(chars: string[]): string {
  const result = [...chars]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1)
    ;[result[i], result[j]] = [result[j] as string, result[i] as string]
  }
  return result.join("")
}

function generateTemporaryPassword(length = TEMP_PASSWORD_LENGTH): string {
  const requiredChars = [
    pickRandomChar(UPPERCASE),
    pickRandomChar(LOWERCASE),
    pickRandomChar(NUMBERS),
    pickRandomChar(SPECIAL),
  ]

  const allChars = `${UPPERCASE}${LOWERCASE}${NUMBERS}${SPECIAL}`
  const remainingChars = Array.from({ length: Math.max(length - requiredChars.length, 0) }, () =>
    pickRandomChar(allChars)
  )

  return shuffleChars([...requiredChars, ...remainingChars])
}

/**
 * POST /api/auth/signup
 *
 * Creates a new user via Clerk Backend API + local database record.
 * Used for admin/coach-created accounts with temporary passwords.
 *
 * For self-service signup, users go through Clerk's <SignUp /> component instead.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validated = signupSchema.parse(body)
    const consent = signupConsentSchema.parse(body)

    const normalizedEmail = validated.email.toLowerCase().trim()

    // Check if user already exists locally (case-insensitive via normalized email)
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }

    const temporaryPassword = generateTemporaryPassword()

    // Create user in Clerk
    let clerkUserId: string | null = null
    try {
      const { clerkClient } = await import("@clerk/nextjs/server")
      const client = await clerkClient()
      const clerkUser = await client.users.createUser({
        emailAddress: [normalizedEmail],
        password: temporaryPassword,
        firstName: validated.name || undefined,
        skipPasswordChecks: true,
      })
      clerkUserId = clerkUser.id
    } catch (clerkErr: any) {
      // If Clerk is not configured (dev mode), continue without Clerk user
      if (clerkErr?.errors?.[0]?.code === "form_identifier_exists") {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 409 }
        )
      }
      console.error("[SIGNUP] Clerk user creation failed:", clerkErr)
      // Continue — local user will be created, Clerk link happens on first sign-in
    }

    const now = new Date()
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      "unknown"
    const userAgent = req.headers.get("user-agent") || undefined

    // Create local user and persist legal consent atomically
    const user = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          clerkId: clerkUserId,
          email: normalizedEmail,
          name: validated.name || null,
          roles: [Role.CLIENT],
          mustChangePassword: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
        },
      })

      const txClient = tx as any
      await txClient.userConsent.create({
        data: {
          userId: createdUser.id,
          termsAccepted: now,
          privacyAccepted: now,
          dataProcessing: now,
          marketing: consent.marketing ? now : null,
          version: "1.0",
          ipAddress: ip,
          userAgent,
        },
      })

      return createdUser
    })

    // Sync metadata to Clerk
    if (clerkUserId) {
      try {
        const { clerkClient } = await import("@clerk/nextjs/server")
        const client = await clerkClient()
        await client.users.updateUserMetadata(clerkUserId, {
          publicMetadata: {
            dbId: user.id,
            roles: [Role.CLIENT],
            isTestUser: false,
            mustChangePassword: true,
            onboardingComplete: false,
          },
        })
      } catch (metaErr) {
        console.error("[SIGNUP] Failed to sync Clerk metadata:", metaErr)
      }
    }

    // Send welcome email (non-blocking)
    const loginUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/login`
    sendSystemEmail({
      templateKey: EMAIL_TEMPLATE_KEYS.WELCOME_CLIENT,
      to: user.email,
      variables: {
        userName: user.name || "",
        userEmail: user.email,
        loginUrl,
        temporaryPassword,
      },
      fallbackSubject: "Welcome to CoachFit - Your Temporary Password",
      fallbackHtml: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">Welcome to CoachFit!</h2>
          <p>Hi${user.name ? ` ${user.name}` : ""},</p>
          <p>Welcome to CoachFit! We've created your account.</p>
          <p>Your temporary password is:</p>
          <p style="font-size: 20px; font-weight: 700; letter-spacing: 1px; background: #f3f4f6; padding: 12px; border-radius: 6px;">
            ${temporaryPassword}
          </p>
          <p>Sign in with your email and this temporary password, then you'll be prompted to set a new password.</p>
          <p style="margin-top: 24px;">
            <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Sign in
            </a>
          </p>
        </div>
      `,
      fallbackText: `Welcome to CoachFit!\n\nHi${user.name ? ` ${user.name}` : ""},\n\nTemporary password: ${temporaryPassword}\n\nSign in: ${loginUrl}`,
      isTestUser: false,
    }).catch((err) => {
      console.error("Error sending welcome email:", err)
    })

    return NextResponse.json(
      {
        message: "Account created successfully. Use your temporary password to sign in.",
        user,
        temporaryPassword,
      },
      { status: 201 }
    )
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }

    console.error("Error creating account:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
