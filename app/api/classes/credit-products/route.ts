import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { CreditPeriodType, CreditProductMode } from "@prisma/client"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin, isAdminOrCoach } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"

const createProductSchema = z.object({
  ownerCoachId: z.string().uuid().optional(),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  appliesToClassTypes: z.array(z.string().min(1).max(50)).default([]),
  creditMode: z.nativeEnum(CreditProductMode),
  creditsPerPeriod: z.number().int().min(0).max(500).optional().nullable(),
  periodType: z.nativeEnum(CreditPeriodType),
  purchasePriceGbp: z.number().min(0).max(10000).optional().nullable(),
  currency: z.string().length(3).default("GBP"),
  purchasableByProviderOnly: z.boolean().default(false),
  classEligible: z.boolean().default(true),
  isActive: z.boolean().default(true),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "true"

    const products = await db.creditProduct.findMany({
      where: {
        ...(includeInactive ? {} : { isActive: true }),
        ...(isAdmin(session.user)
          ? {}
          : {
              OR: [{ ownerCoachId: null }, { ownerCoachId: session.user.id }],
            }),
      },
      orderBy: [{ classEligible: "desc" }, { name: "asc" }],
    })

    return NextResponse.json({ products }, { status: 200 })
  } catch (error) {
    console.error("Error loading credit products:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const parsed = createProductSchema.parse(body)

    const ownerCoachId = isAdmin(session.user)
      ? parsed.ownerCoachId ?? session.user.id
      : session.user.id

    const product = await db.creditProduct.create({
      data: {
        ownerCoachId,
        name: parsed.name,
        description: parsed.description ?? null,
        appliesToClassTypes: parsed.appliesToClassTypes,
        creditMode: parsed.creditMode,
        creditsPerPeriod: parsed.creditsPerPeriod ?? null,
        periodType: parsed.periodType,
        purchasePriceGbp: parsed.purchasePriceGbp ?? null,
        currency: parsed.currency,
        purchasableByProviderOnly: parsed.purchasableByProviderOnly,
        classEligible: parsed.classEligible,
        isActive: parsed.isActive,
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CLASS_CREDIT_PRODUCT_CREATE",
      targetType: "credit_product",
      targetId: product.id,
      details: {
        name: product.name,
        creditMode: product.creditMode,
        classEligible: product.classEligible,
      },
    })

    return NextResponse.json({ product }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 },
      )
    }

    console.error("Error creating credit product:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
