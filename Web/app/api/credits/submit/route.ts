import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAuditAction } from "@/lib/audit-log"
import { CreditSubmissionStatus } from "@prisma/client"

const submitSchema = z.object({
  creditProductId: z.string().uuid(),
  revolutReference: z.string().max(200).optional(),
  note: z.string().max(500).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validated = submitSchema.parse(body)

    // Verify product exists and is active
    const product = await db.creditProduct.findUnique({
      where: { id: validated.creditProductId },
      select: {
        id: true,
        name: true,
        isActive: true,
        purchasableByProviderOnly: true,
        allowRepeatPurchase: true,
        creditsPerPeriod: true,
      },
    })

    if (!product || !product.isActive) {
      return NextResponse.json({ error: "Credit product not found or inactive" }, { status: 400 })
    }

    if (product.purchasableByProviderOnly) {
      return NextResponse.json(
        { error: "This product can only be purchased by a coach or admin" },
        { status: 403 }
      )
    }

    if (!product.allowRepeatPurchase) {
      const existingApproved = await db.creditSubmission.findFirst({
        where: {
          clientId: session.user.id,
          creditProductId: validated.creditProductId,
          status: CreditSubmissionStatus.APPROVED,
        },
      })
      if (existingApproved) {
        return NextResponse.json(
          { error: "You have already purchased this product and repeat purchases are not allowed" },
          { status: 400 }
        )
      }
    }

    // Manual payment flow: client submits, coach/admin approves
    const submission = await db.creditSubmission.create({
      data: {
        clientId: session.user.id,
        creditProductId: validated.creditProductId,
        revolutReference: validated.revolutReference ?? null,
        note: validated.note ?? null,
        status: CreditSubmissionStatus.PENDING,
        paymentMethod: "manual_transfer",
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CREDIT_SUBMISSION_CREATE",
      targetType: "credit_submission",
      targetId: submission.id,
      details: {
        creditProductId: product.id,
        productName: product.name,
        paymentMethod: "manual_transfer",
      },
    })

    return NextResponse.json({ submission }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error creating credit submission:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
