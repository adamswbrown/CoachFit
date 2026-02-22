import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { CreditSubmissionStatus } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { creditSubmissionCreateSchema } from "@/lib/validations"
import { logAuditAction } from "@/lib/audit-log"
import { getSystemSettings } from "@/lib/system-settings"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isClient(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const systemSettings = await getSystemSettings()
    if (!systemSettings.classBookingEnabled) {
      return NextResponse.json(
        { error: "Class booking is currently disabled", code: "CLASS_BOOKING_DISABLED" },
        { status: 403 },
      )
    }

    const submissions = await db.creditSubmission.findMany({
      where: {
        clientId: session.user.id,
      },
      include: {
        creditProduct: {
          select: {
            id: true,
            name: true,
            creditMode: true,
            creditsPerPeriod: true,
            periodType: true,
            purchasePriceGbp: true,
            currency: true,
            appliesToClassTypes: true,
            classEligible: true,
            purchasableByProviderOnly: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    })

    const products = await db.creditProduct.findMany({
      where: {
        isActive: true,
        classEligible: true,
        purchasableByProviderOnly: false,
      },
      select: {
        id: true,
        name: true,
        creditMode: true,
        creditsPerPeriod: true,
        periodType: true,
        purchasePriceGbp: true,
        currency: true,
        appliesToClassTypes: true,
      },
      orderBy: {
        name: "asc",
      },
    })

    return NextResponse.json({ submissions, products }, { status: 200 })
  } catch (error) {
    console.error("Error fetching credit submissions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isClient(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const systemSettings = await getSystemSettings()
    if (!systemSettings.classBookingEnabled) {
      return NextResponse.json(
        { error: "Class booking is currently disabled", code: "CLASS_BOOKING_DISABLED" },
        { status: 403 },
      )
    }

    const body = await req.json()
    const parsed = creditSubmissionCreateSchema.parse(body)

    const product = await db.creditProduct.findUnique({
      where: { id: parsed.creditProductId },
      select: {
        id: true,
        name: true,
        classEligible: true,
        isActive: true,
        purchasableByProviderOnly: true,
      },
    })

    if (!product || !product.isActive || !product.classEligible) {
      return NextResponse.json(
        { error: "Credit product not available" },
        { status: 404 },
      )
    }

    if (product.purchasableByProviderOnly) {
      return NextResponse.json(
        { error: "This product can only be assigned by a coach" },
        { status: 403 },
      )
    }

    const existingPending = await db.creditSubmission.findFirst({
      where: {
        clientId: session.user.id,
        creditProductId: parsed.creditProductId,
        revolutReference: parsed.revolutReference,
        status: CreditSubmissionStatus.PENDING,
      },
      select: { id: true },
    })

    if (existingPending) {
      return NextResponse.json(
        { error: "A pending submission with this reference already exists" },
        { status: 409 },
      )
    }

    const submission = await db.creditSubmission.create({
      data: {
        clientId: session.user.id,
        creditProductId: parsed.creditProductId,
        revolutReference: parsed.revolutReference,
        note: parsed.note ?? null,
        status: CreditSubmissionStatus.PENDING,
      },
      include: {
        creditProduct: {
          select: {
            id: true,
            name: true,
            creditsPerPeriod: true,
            creditMode: true,
          },
        },
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CLASS_CREDIT_SUBMISSION_CREATE",
      targetType: "credit_submission",
      targetId: submission.id,
      details: {
        creditProductId: parsed.creditProductId,
        revolutReference: parsed.revolutReference,
      },
    })

    return NextResponse.json({ submission }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 },
      )
    }

    console.error("Error creating credit submission:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
