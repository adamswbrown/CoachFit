import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { logAuditAction } from "@/lib/audit-log"
import { creditSubmissionSchema } from "@/lib/validations/credits"
import { createRevolutOrder } from "@/lib/revolut"
import { CreditSubmissionStatus } from "@prisma/client"

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const validated = creditSubmissionSchema.parse(body)

    // Verify product exists and is active
    const product = await db.creditProduct.findUnique({
      where: { id: validated.creditProductId },
      select: {
        id: true,
        name: true,
        isActive: true,
        purchasableByProviderOnly: true,
        allowRepeatPurchase: true,
        purchasePriceGbp: true,
        creditsPerPeriod: true,
        currency: true,
      },
    })

    if (!product || !product.isActive) {
      return NextResponse.json({ error: "Credit product not found or inactive" }, { status: 400 })
    }

    // Block client purchases on provider-only products
    if (product.purchasableByProviderOnly) {
      return NextResponse.json(
        { error: "This product can only be purchased by a coach or admin" },
        { status: 403 }
      )
    }

    // Check repeat purchase policy
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

    const paymentMethod = validated.paymentMethod ?? "revolut_checkout"

    if (paymentMethod === "revolut_checkout") {
      // Require a price to create a Revolut order
      if (!product.purchasePriceGbp || product.purchasePriceGbp <= 0) {
        return NextResponse.json(
          { error: "This product does not have a purchase price configured for online checkout" },
          { status: 400 }
        )
      }

      // Create submission first (PENDING), then create Revolut order
      const submission = await db.creditSubmission.create({
        data: {
          clientId: session.user.id,
          creditProductId: validated.creditProductId,
          note: validated.note ?? null,
          status: CreditSubmissionStatus.PENDING,
          paymentMethod: "revolut_checkout",
        },
      })

      // Amount in pence (minor units) — never use float arithmetic
      const amountPence = Math.round(product.purchasePriceGbp * 100)

      try {
        const { orderId, checkoutUrl } = await createRevolutOrder({
          amount: amountPence,
          currency: product.currency ?? "GBP",
          description: `CoachFit: ${product.name}`,
          metadata: {
            submissionId: submission.id,
            clientId: session.user.id,
            creditProductId: product.id,
          },
        })

        // Store order details on the submission
        const updatedSubmission = await db.creditSubmission.update({
          where: { id: submission.id },
          data: {
            revolutOrderId: orderId,
            revolutCheckoutUrl: checkoutUrl,
          },
        })

        await logAuditAction({
          actor: session.user,
          actionType: "CREDIT_SUBMISSION_CREATE",
          targetType: "credit_submission",
          targetId: submission.id,
          details: {
            creditProductId: product.id,
            paymentMethod: "revolut_checkout",
            revolutOrderId: orderId,
          },
        })

        return NextResponse.json(
          { submission: updatedSubmission, checkoutUrl },
          { status: 201 }
        )
      } catch (revolutError: any) {
        // Revolut API failed — clean up the submission and return a clear error
        await db.creditSubmission.delete({ where: { id: submission.id } })
        console.error("Revolut API error:", revolutError)
        return NextResponse.json(
          { error: `Payment provider error: ${revolutError.message}` },
          { status: 500 }
        )
      }
    }

    // manual_transfer flow
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
