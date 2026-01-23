import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"
import { z } from "zod"
import { sendSystemEmail } from "@/lib/email"
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates"
import { logAuditAction } from "@/lib/audit-log"

const createInviteSchema = z.object({
  email: z.string().email("Invalid email format"),
})

// GET /api/invites - List all pending invites for the current coach
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden: Coach or Admin access required" }, { status: 403 })
    }

    const invites = await db.coachInvite.findMany({
      where: { coachId: session.user.id },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ invites }, { status: 200 })
  } catch (error) {
    console.error("Error fetching invites:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/invites - Create a global invite (not tied to a cohort)
export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden: Coach or Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { email } = createInviteSchema.parse(body)

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true, invitedByCoachId: true },
    })

    if (existingUser) {
      // If user exists but isn't linked to a coach yet, link them
      if (!existingUser.invitedByCoachId) {
        await db.user.update({
          where: { id: existingUser.id },
          data: { invitedByCoachId: session.user.id },
        })
        await logAuditAction({
          actor: session.user,
          actionType: "COACH_LINK_EXISTING_CLIENT",
          targetType: "user",
          targetId: existingUser.id,
          details: { email },
        })
        return NextResponse.json(
          { message: "User already exists and has been linked to you", userId: existingUser.id },
          { status: 200 }
        )
      }
      
      // User exists and is already linked to a coach
      if (existingUser.invitedByCoachId === session.user.id) {
        return NextResponse.json(
          { error: "This client is already linked to you" },
          { status: 409 }
        )
      } else {
        return NextResponse.json(
          { error: "This user is already linked to another coach" },
          { status: 409 }
        )
      }
    }

    // Check for existing invite from this coach
    const existingInvite = await db.coachInvite.findUnique({
      where: {
        email_coachId: {
          email,
          coachId: session.user.id,
        },
      },
    })

    if (existingInvite) {
      return NextResponse.json(
        { error: "You have already invited this email" },
        { status: 409 }
      )
    }

    // Create the invite
    const invite = await db.coachInvite.create({
      data: {
        email,
        coachId: session.user.id,
      },
    })

    // Send invite email
    const coachName = session.user.name || session.user.email
    const loginUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login?invited=1`
    const isTestUserEmail = email.endsWith(".test.local")

    await sendSystemEmail({
      templateKey: EMAIL_TEMPLATE_KEYS.COACH_INVITE,
      to: email,
      variables: {
        coachName,
        userEmail: email,
        loginUrl,
      },
      fallbackSubject: "You've been invited to CoachSync",
      fallbackHtml: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">You've been invited to CoachSync</h2>
          <p>Hi there,</p>
          <p><strong>${coachName}</strong> has invited you to join CoachSync to track your fitness progress.</p>
          <p>Sign in to get started.</p>
          <p style="margin-top: 24px;">
            <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Sign in to get started
            </a>
          </p>
          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
            If you have any questions, please contact your coach.
          </p>
        </div>
      `,
      fallbackText: `You've been invited to CoachSync\n\n${coachName} has invited you to join CoachSync to track your fitness progress.\n\nSign in to get started: ${loginUrl}\n\nIf you have any questions, please contact your coach.`,
      isTestUser: isTestUserEmail,
    })

    await logAuditAction({
      actor: session.user,
      actionType: "COACH_CREATE_INVITE",
      targetType: "coach_invite",
      targetId: invite.id,
      details: { email },
    })

    return NextResponse.json({ invite }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }
    console.error("Error creating invite:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
