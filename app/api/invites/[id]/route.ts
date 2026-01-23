import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { sendSystemEmail } from "@/lib/email"
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates"
import { logAuditAction } from "@/lib/audit-log"

// DELETE /api/invites/[id] - Cancel/delete an invite
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden: Coach or Admin access required" }, { status: 403 })
    }

    // Find the invite and verify ownership
    const invite = await db.coachInvite.findUnique({
      where: { id },
    })

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }

    if (!isAdmin(session.user) && invite.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden: Not your invite" }, { status: 403 })
    }

    await db.coachInvite.delete({
      where: { id },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "COACH_DELETE_INVITE",
      targetType: "coach_invite",
      targetId: invite.id,
      details: { email: invite.email },
    })

    return NextResponse.json({ message: "Invite cancelled" }, { status: 200 })
  } catch (error) {
    console.error("Error deleting invite:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/invites/[id] - Resend a global invite
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden: Coach or Admin access required" }, { status: 403 })
    }

    const invite = await db.coachInvite.findUnique({
      where: { id },
    })

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }

    if (!isAdmin(session.user) && invite.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden: Not your invite" }, { status: 403 })
    }

    const coach = await db.user.findUnique({
      where: { id: invite.coachId },
      select: { name: true, email: true },
    })

    const coachName = coach?.name || coach?.email || "Your coach"
    const loginUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login?invited=1`
    const isTestUserEmail = invite.email.endsWith(".test.local")

    await sendSystemEmail({
      templateKey: EMAIL_TEMPLATE_KEYS.COACH_INVITE,
      to: invite.email,
      variables: {
        coachName,
        userEmail: invite.email,
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
      actionType: "COACH_RESEND_INVITE",
      targetType: "coach_invite",
      targetId: invite.id,
      details: { email: invite.email },
    })

    return NextResponse.json({ message: "Invite resent" }, { status: 200 })
  } catch (error) {
    console.error("Error resending invite:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
