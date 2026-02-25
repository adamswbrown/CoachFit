import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { signupSchema } from "@/lib/validations"
import { sendSystemEmail } from "@/lib/email"
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates"
import { Role } from "@/lib/types"
import bcrypt from "bcryptjs"
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validated = signupSchema.parse(body)
    const consent = signupConsentSchema.parse(body)

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: validated.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      )
    }

    const temporaryPassword = generateTemporaryPassword()
    const passwordHash = await bcrypt.hash(temporaryPassword, 12)

    const now = new Date()
    const ip =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      "unknown"
    const userAgent = req.headers.get("user-agent") || undefined

    // Create user and persist legal consent atomically.
    const user = await db.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email: validated.email,
          name: validated.name || null,
          passwordHash,
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

    // Send welcome email (non-blocking)
    const loginUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`
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
          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
            If you have any questions, please contact your coach.
          </p>
        </div>
      `,
      fallbackText: `Welcome to CoachFit!\n\nHi${user.name ? ` ${user.name}` : ""},\n\nWelcome to CoachFit! We've created your account.\n\nTemporary password: ${temporaryPassword}\n\nSign in with your email and this temporary password: ${loginUrl}\n\nYou'll be prompted to set a new password after signing in.\n\nIf you have any questions, please contact your coach.`,
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
