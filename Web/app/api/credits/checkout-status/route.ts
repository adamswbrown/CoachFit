import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"
import { CreditSubmissionStatus } from "@prisma/client"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const submissionId = req.nextUrl.searchParams.get("submissionId")
    if (!submissionId) {
      return NextResponse.json({ error: "submissionId is required" }, { status: 400 })
    }

    const submission = await db.creditSubmission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        clientId: true,
        status: true,
        paymentMethod: true,
        paidAt: true,
        creditProductId: true,
        creditProduct: {
          select: { name: true, creditsPerPeriod: true },
        },
      },
    })

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 })
    }

    // Clients can only see their own submissions; coaches/admins can see any
    if (submission.clientId !== session.user.id && !isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(
      {
        submissionId: submission.id,
        status: submission.status,
        creditsAdded:
          submission.status === CreditSubmissionStatus.APPROVED
            ? (submission.creditProduct?.creditsPerPeriod ?? 0)
            : 0,
        paidAt: submission.paidAt,
        productName: submission.creditProduct?.name ?? null,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching checkout status:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
