import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { sendSystemEmail } from "@/lib/email"
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates"
import { logAuditAction } from "@/lib/audit-log"

const createCoachSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

// GET /api/admin/coaches - List all coaches (already exists, keep for compatibility)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const coaches = await db.user.findMany({
      where: {
        roles: {
          has: Role.COACH,
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: {
        name: "asc",
      },
    })

    return NextResponse.json({ coaches }, { status: 200 })
  } catch (error) {
    console.error("Error fetching coaches:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/admin/coaches - Create a new coach user
export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { email, name, password } = createCoachSchema.parse(body)

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user with COACH role
    const newCoach = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
        mustChangePassword: false,
        roles: [Role.COACH],
      },
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        createdAt: true,
      },
    })

    // Send welcome email to new coach
    const loginUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`
    const isTestUserEmail = email.endsWith(".test.local")

    await sendSystemEmail({
      templateKey: EMAIL_TEMPLATE_KEYS.WELCOME_COACH,
      to: email,
      variables: {
        userName: name,
        userEmail: email,
        loginUrl,
      },
      fallbackSubject: "Welcome to CoachFit - Your Coach Account",
      fallbackHtml: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">Welcome to CoachFit!</h2>
          <p>Hi ${name},</p>
          <p>Your coach account has been created. You can now log in and start managing your cohorts and clients.</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> (the one provided by your administrator)</p>
          <p style="margin-top: 24px;">
            <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Sign in to your dashboard
            </a>
          </p>
          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
            If you have any questions, please contact your administrator.
          </p>
        </div>
      `,
      fallbackText: `Welcome to CoachFit!\n\nHi ${name},\n\nYour coach account has been created.\n\nEmail: ${email}\nPassword: (the one provided by your administrator)\n\nSign in: ${loginUrl}\n\nIf you have any questions, please contact your administrator.`,
      isTestUser: isTestUserEmail,
    })

    await logAuditAction({
      actor: session.user,
      actionType: "ADMIN_CREATE_COACH",
      targetType: "user",
      targetId: newCoach.id,
      details: { email: newCoach.email, name: newCoach.name, roles: newCoach.roles },
    })
    return NextResponse.json(
      {
        coach: newCoach,
        message: "Coach created successfully",
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      )
    }
    console.error("Error creating coach:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
