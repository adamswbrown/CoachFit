import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSessionWithMobile } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { isAdminOrCoach, isAdmin, isCoach } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { Role } from "@/lib/types"

// Inline Zod schema — mirrors createCreditProductSchema from @/lib/validations/credits
const createCreditProductSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  creditMode: z.enum(["MONTHLY_TOPUP", "ONE_TIME_PACK", "CATALOG_ONLY"]),
  creditsPerPeriod: z.number().int().positive().optional(),
  periodType: z.enum(["MONTH", "ONE_TIME"]).optional(),
  purchasePriceGbp: z.number().positive().optional(),
  appliesToClassTypes: z.array(z.string()).default([]),
  purchasableByProviderOnly: z.boolean().default(false),
  classEligible: z.boolean().default(true),
  allowRepeatPurchase: z.boolean().default(true),
  rolloverPolicy: z.string().default("NONE"),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionWithMobile()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const activeParam = searchParams.get("active")

    // Determine role
    const userIsAdmin = isAdmin(session.user)
    const userIsCoach = isCoach(session.user)

    let whereClause: any

    if (userIsAdmin) {
      // Admin sees all products; respect ?active= filter if provided
      whereClause = activeParam !== null ? { isActive: activeParam === "true" } : {}
    } else if (userIsCoach) {
      // Coach sees their own products + all active products
      const filterActive = activeParam === null ? true : activeParam === "true"
      whereClause = filterActive
        ? {
            OR: [
              { ownerCoachId: session.user.id },
              { isActive: true },
            ],
          }
        : { ownerCoachId: session.user.id }
    } else {
      // Client: only active, client-purchasable products
      whereClause = {
        isActive: true,
        purchasableByProviderOnly: false,
      }
    }

    const products = await db.creditProduct.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json(products, { status: 200 })
  } catch (error) {
    console.error("Error fetching credit products:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionWithMobile()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = createCreditProductSchema.parse(body)

    const product = await db.creditProduct.create({
      data: {
        ownerCoachId: session.user.id,
        name: validated.name,
        description: validated.description ?? null,
        creditMode: validated.creditMode,
        creditsPerPeriod: validated.creditsPerPeriod ?? null,
        periodType: validated.periodType ?? "ONE_TIME",
        purchasePriceGbp: validated.purchasePriceGbp ?? null,
        appliesToClassTypes: validated.appliesToClassTypes,
        purchasableByProviderOnly: validated.purchasableByProviderOnly,
        classEligible: validated.classEligible,
        allowRepeatPurchase: validated.allowRepeatPurchase,
        rolloverPolicy: validated.rolloverPolicy,
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CREDIT_PRODUCT_CREATE",
      targetType: "credit_product",
      targetId: product.id,
      details: { name: product.name, creditMode: product.creditMode },
    })

    return NextResponse.json(product, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error creating credit product:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
