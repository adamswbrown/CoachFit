import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"
import { z } from "zod"
import { sendSystemEmail } from "@/lib/email"
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates"
import { logAuditAction } from "@/lib/audit-log"

const createInviteSchema = z.object({
  email: z.string().email("Invalid email format").transform((e) => e.toLowerCase().trim()),
})

// GET /api/admin/platform-invites - List all platform invites
export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const invites = await db.platformInvite.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        User: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({
      invites: invites.map((inv) => ({
        id: inv.id,
        email: inv.email,
        invitedBy: inv.User,
        createdAt: inv.createdAt,
        usedAt: inv.usedAt,
      })),
    })
  } catch (error) {
    console.error("Error fetching platform invites:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/admin/platform-invites - Create a platform invite
export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { email } = createInviteSchema.parse(body)

    // Check if already invited
    const existing = await db.platformInvite.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: "This email has already been invited" },
        { status: 409 }
      )
    }

    // Check if user already exists (already has access)
    const existingUser = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true },
    })
    if (existingUser) {
      return NextResponse.json(
        { error: "This user already has an account" },
        { status: 409 }
      )
    }

    const invite = await db.platformInvite.create({
      data: {
        email,
        invitedBy: session.user.id,
      },
    })

    // Send invite email
    const signupUrl = `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"}/signup`
    const isTestUserEmail = email.endsWith(".test.local")

    await sendSystemEmail({
      templateKey: EMAIL_TEMPLATE_KEYS.PLATFORM_INVITE,
      to: email,
      variables: {
        loginUrl: signupUrl,
      },
      fallbackSubject: "You've been invited to CoachFit",
      fallbackHtml: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">You've been invited to CoachFit</h2>
          <p>Hi there,</p>
          <p>You've been invited to join CoachFit. Create your account to get started.</p>
          <p style="margin-top: 24px;">
            <a href="${signupUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Create your account
            </a>
          </p>
        </div>
      `,
      fallbackText: `You've been invited to CoachFit!\n\nCreate your account to get started: ${signupUrl}`,
      isTestUser: isTestUserEmail,
    }).catch((err: unknown) => console.error("Error sending platform invite email:", err))

    await logAuditAction({
      actor: session.user,
      actionType: "PLATFORM_INVITE_CREATE",
      targetType: "platform_invite",
      targetId: invite.id,
      details: { email },
    })

    return NextResponse.json({ invite }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }
    console.error("Error creating platform invite:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
