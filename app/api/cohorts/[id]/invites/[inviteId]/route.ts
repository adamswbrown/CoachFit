import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { isAdmin } from "@/lib/permissions"
import { sendSystemEmail } from "@/lib/email"
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates"
import { logAuditAction } from "@/lib/audit-log"

async function authorizeCohortAccess(userId: string, cohortId: string, isAdminUser: boolean) {
  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
  })

  if (!cohort) {
    return { error: NextResponse.json({ error: "Cohort not found" }, { status: 404 }) }
  }

  if (isAdminUser) {
    return { cohort }
  }

  if (cohort.coachId === userId) {
    return { cohort }
  }

  const isCoCoach = await db.coachCohortMembership.findUnique({
    where: {
      coachId_cohortId: {
        coachId: userId,
        cohortId,
      },
    },
  })

  if (!isCoCoach) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { cohort }
}

// DELETE /api/cohorts/[id]/invites/[inviteId] - Cancel/delete a cohort invite
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const session = await auth()
    const { id, inviteId } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdminUser = isAdmin(session.user)
    if (!session.user.roles.includes(Role.COACH) && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { cohort, error } = await authorizeCohortAccess(session.user.id, id, isAdminUser)
    if (error) return error

    const invite = await db.cohortInvite.findUnique({
      where: { id: inviteId },
    })

    if (!invite || invite.cohortId !== cohort!.id) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }

    await db.cohortInvite.delete({
      where: { id: inviteId },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "COHORT_INVITE_CANCEL",
      targetType: "cohort_invite",
      targetId: inviteId,
      details: {
        cohortId: cohort!.id,
        email: invite.email,
      },
    })

    return NextResponse.json({ message: "Invite cancelled" }, { status: 200 })
  } catch (error) {
    console.error("Error deleting cohort invite:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// POST /api/cohorts/[id]/invites/[inviteId] - Resend a cohort invite
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; inviteId: string }> }
) {
  try {
    const session = await auth()
    const { id, inviteId } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAdminUser = isAdmin(session.user)
    if (!session.user.roles.includes(Role.COACH) && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { cohort, error } = await authorizeCohortAccess(session.user.id, id, isAdminUser)
    if (error) return error

    const invite = await db.cohortInvite.findUnique({
      where: { id: inviteId },
    })

    if (!invite || invite.cohortId !== cohort!.id) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }

    const coach = await db.user.findUnique({
      where: { id: cohort!.coachId },
      select: { name: true, email: true },
    })

    const coachName = coach?.name || coach?.email || "Your coach"
    const cohortName = cohort!.name
    const loginUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`
    const isTestUserEmail = invite.email.endsWith(".test.local")

    await sendSystemEmail({
      templateKey: EMAIL_TEMPLATE_KEYS.COHORT_INVITE,
      to: invite.email,
      variables: {
        coachName,
        cohortName,
        userEmail: invite.email,
        loginUrl,
      },
      fallbackSubject: "You've been invited to CoachFit",
      fallbackHtml: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1f2937;">You've been invited to CoachFit</h2>
          <p>Hi there,</p>
          <p><strong>${coachName}</strong> has invited you to join the <strong>${cohortName}</strong> cohort.</p>
          <p>Sign up to get started and begin tracking your progress.</p>
          <p style="margin-top: 24px;">
            <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Sign up to get started
            </a>
          </p>
          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
            If you have any questions, please contact your coach.
          </p>
        </div>
      `,
      fallbackText: `You've been invited to CoachFit\n\n${coachName} has invited you to join the ${cohortName} cohort.\n\nSign up to get started: ${loginUrl}\n\nIf you have any questions, please contact your coach.`,
      isTestUser: isTestUserEmail,
    })

    await logAuditAction({
      actor: session.user,
      actionType: "COHORT_INVITE_RESEND",
      targetType: "cohort_invite",
      targetId: invite.id,
      details: {
        cohortId: cohort!.id,
        email: invite.email,
      },
    })

    return NextResponse.json({ message: "Invite resent" }, { status: 200 })
  } catch (error) {
    console.error("Error resending cohort invite:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
