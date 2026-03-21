import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { approveRejectSubmissionSchema } from "@/lib/validations/credits"
import { processSubmission } from "@/lib/credits"
import { CreditSubmissionStatus } from "@prisma/client"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    const submission = await db.creditSubmission.findUnique({
      where: { id },
      select: { id: true, status: true, clientId: true, creditProductId: true },
    })
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }

    if (submission.status !== CreditSubmissionStatus.PENDING) {
      return NextResponse.json(
        { error: `Submission has already been ${submission.status.toLowerCase()}` },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { action } = approveRejectSubmissionSchema.parse(body)

    await processSubmission(id, action, session.user.id)

    const updated = await db.creditSubmission.findUnique({ where: { id } })

    await logAuditAction({
      actor: session.user,
      actionType: action === "APPROVE" ? "CREDIT_SUBMISSION_APPROVE" : "CREDIT_SUBMISSION_REJECT",
      targetType: "credit_submission",
      targetId: id,
      details: {
        clientId: submission.clientId,
        creditProductId: submission.creditProductId,
        action,
      },
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.includes("credits configured")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Error processing submission:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
