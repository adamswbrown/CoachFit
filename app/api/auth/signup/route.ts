import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { signupSchema } from "@/lib/validations"
import { sendSystemEmail } from "@/lib/email"
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates"
import { Role } from "@/lib/types"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const validated = signupSchema.parse(body)

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

    const [coachInvites, cohortInvites] = await Promise.all([
      db.coachInvite.findMany({
        where: { email: validated.email },
        select: { id: true },
      }),
      db.cohortInvite.findMany({
        where: { email: validated.email },
        select: { id: true },
      }),
    ])

    const hasInvite = coachInvites.length > 0 || cohortInvites.length > 0

    // Hash password with increased cost factor (12 rounds)
    const passwordHash = await bcrypt.hash(validated.password, 12)

    // Create user
    const user = await db.user.create({
      data: {
        email: validated.email,
        name: validated.name || null,
        passwordHash,
        roles: [Role.CLIENT],
        mustChangePassword: hasInvite,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
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
      },
      fallbackSubject: "Welcome to CoachFit",
      fallbackHtml: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">Welcome to CoachFit!</h2>
          <p>Hi${user.name ? ` ${user.name}` : ""},</p>
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
      fallbackText: `Welcome to CoachFit!\n\nHi${user.name ? ` ${user.name}` : ""},\n\nWelcome to CoachFit! We're excited to have you on board.\n\nYou're all set — your coach will guide you next.\n\nSign in to your dashboard: ${loginUrl}\n\nIf you have any questions, please contact your coach.`,
      isTestUser: false,
    }).catch((err) => {
      console.error("Error sending welcome email:", err)
    })

    return NextResponse.json(
      { message: "Account created successfully", user },
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
