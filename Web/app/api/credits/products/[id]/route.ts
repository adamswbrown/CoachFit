import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { updateCreditProductSchema } from "@/lib/validations/credits"

export async function GET(
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
    const product = await db.creditProduct.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: "Credit product not found" }, { status: 404 })
    }

    if (product.ownerCoachId !== session.user.id && !isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(product, { status: 200 })
  } catch (error) {
    console.error("Error fetching credit product:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const product = await db.creditProduct.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: "Credit product not found" }, { status: 404 })
    }

    const body = await req.json()
    const validated = updateCreditProductSchema.parse(body)

    const updated = await db.creditProduct.update({
      where: { id },
      data: {
        ...(validated.name !== undefined && { name: validated.name }),
        ...(validated.description !== undefined && { description: validated.description }),
        ...(validated.creditMode !== undefined && { creditMode: validated.creditMode }),
        ...(validated.creditsPerPeriod !== undefined && { creditsPerPeriod: validated.creditsPerPeriod }),
        ...(validated.periodType !== undefined && { periodType: validated.periodType }),
        ...(validated.purchasePriceGbp !== undefined && { purchasePriceGbp: validated.purchasePriceGbp }),
        ...(validated.appliesToClassTypes !== undefined && { appliesToClassTypes: validated.appliesToClassTypes }),
        ...(validated.purchasableByProviderOnly !== undefined && { purchasableByProviderOnly: validated.purchasableByProviderOnly }),
        ...(validated.classEligible !== undefined && { classEligible: validated.classEligible }),
        ...(validated.allowRepeatPurchase !== undefined && { allowRepeatPurchase: validated.allowRepeatPurchase }),
        ...(validated.rolloverPolicy !== undefined && { rolloverPolicy: validated.rolloverPolicy }),
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CREDIT_PRODUCT_UPDATE",
      targetType: "credit_product",
      targetId: id,
      details: { updatedFields: Object.keys(validated) },
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error updating credit product:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params
    const product = await db.creditProduct.findUnique({ where: { id } })
    if (!product) {
      return NextResponse.json({ error: "Credit product not found" }, { status: 404 })
    }

    // Soft-delete: set isActive = false
    await db.creditProduct.update({
      where: { id },
      data: { isActive: false },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CREDIT_PRODUCT_DELETE",
      targetType: "credit_product",
      targetId: id,
      details: { name: product.name },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error("Error deleting credit product:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
