import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { creditSubmissionReviewSchema } from "@/lib/validations"
import { reviewCreditSubmission, isClassBookingError } from "@/lib/classes-service"
import { logAuditAction } from "@/lib/audit-log"
import { sendTransactionalEmail } from "@/lib/email"

async function canAccessSubmission(submissionId: string, user: { id: string; roles: any[] }) {
  if (isAdmin(user as any)) {
    return db.creditSubmission.findUnique({ where: { id: submissionId }, select: { id: true } })
  }

  return db.creditSubmission.findFirst({
    where: {
      id: submissionId,
      OR: [
        { client: { invitedByCoachId: user.id } },
        {
          client: {
            CohortMembership: {
              some: {
                Cohort: {
                  OR: [
                    { coachId: user.id },
                    { coachMemberships: { some: { coachId: user.id } } },
                  ],
                },
              },
            },
          },
        },
        { creditProduct: { ownerCoachId: user.id } },
      ],
    },
    select: { id: true },
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const hasAccess = await canAccessSubmission(id, session.user)
    if (!hasAccess) {
      return NextResponse.json({ error: "Credit submission not found" }, { status: 404 })
    }

    const body = await req.json()
    const parsed = creditSubmissionReviewSchema.parse(body)

    const action = parsed.action === "APPROVE" ? "APPROVE" : "REJECT"

    const result = await reviewCreditSubmission({
      submissionId: id,
      action,
      reviewerId: session.user.id,
    })

    const client = result.submission.client
    const product = result.submission.creditProduct

    await logAuditAction({
      actor: session.user,
      actionType: "CLASS_CREDIT_SUBMISSION_REVIEW",
      targetType: "credit_submission",
      targetId: id,
      details: {
        action,
        creditsApplied: result.creditsApplied,
        note: parsed.note || null,
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CLASS_IN_APP_NOTIFICATION",
      targetType: "class_notification",
      targetId: client.id,
      details: {
        kind: action === "APPROVE" ? "credit_approved" : "credit_rejected",
        productName: product.name,
        creditsApplied: result.creditsApplied,
        note: parsed.note || null,
      },
    })

    await sendTransactionalEmail({
      to: client.email,
      subject:
        action === "APPROVE"
          ? `Credit approved: ${product.name}`
          : `Credit submission rejected: ${product.name}`,
      html:
        action === "APPROVE"
          ? `<p>Hi ${client.name || client.email},</p><p>Your credit submission for <strong>${product.name}</strong> has been approved.</p><p>Credits added: <strong>${result.creditsApplied}</strong></p>`
          : `<p>Hi ${client.name || client.email},</p><p>Your credit submission for <strong>${product.name}</strong> has been rejected.</p><p>${parsed.note ? `Note: ${parsed.note}` : "Please contact your coach for details."}</p>`,
      text:
        action === "APPROVE"
          ? `Hi ${client.name || client.email},\n\nYour credit submission for ${product.name} has been approved.\nCredits added: ${result.creditsApplied}`
          : `Hi ${client.name || client.email},\n\nYour credit submission for ${product.name} was rejected.\n${parsed.note || "Please contact your coach for details."}`,
      isTestUser: client.isTestUser,
    })

    return NextResponse.json({ submission: result.submission }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 },
      )
    }

    if (isClassBookingError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode })
    }

    console.error("Error reviewing credit submission:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
