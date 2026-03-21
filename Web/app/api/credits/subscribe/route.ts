import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { CreditLedgerReason } from "@prisma/client"

// Inline Zod schema — mirrors subscribeClientSchema from @/lib/validations/credits
const subscribeClientSchema = z.object({
  clientId: z.string().uuid(),
  creditProductId: z.string().uuid(),
  monthlyCredits: z.number().int().positive(),
  startDate: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = subscribeClientSchema.parse(body)

    // Verify client exists
    const client = await db.user.findUnique({
      where: { id: validated.clientId },
      select: { id: true, name: true, email: true },
    })
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 400 })
    }

    // ATOMICITY FIX: All credit operations in a single transaction
    const { subscription } = await db.$transaction(async (tx) => {
      // 1. Verify the credit product exists and is active
      const product = await tx.creditProduct.findUnique({
        where: { id: validated.creditProductId },
        select: { id: true, name: true, isActive: true, creditsPerPeriod: true },
      })
      if (!product || !product.isActive) {
        throw new Error("Credit product not found or inactive")
      }

      // 2. Create the subscription
      const sub = await tx.clientCreditSubscription.create({
        data: {
          clientId: validated.clientId,
          creditProductId: validated.creditProductId,
          monthlyCredits: validated.monthlyCredits,
          active: true,
          startDate: new Date(validated.startDate),
        },
      })

      // 3. Ensure credit account exists (upsert)
      await tx.clientCreditAccount.upsert({
        where: { clientId: validated.clientId },
        create: {
          clientId: validated.clientId,
          balance: 0,
        },
        update: {},
      })

      // 4. Create ledger entry for first month's topup
      await tx.clientCreditLedger.create({
        data: {
          clientId: validated.clientId,
          deltaCredits: validated.monthlyCredits,
          reason: CreditLedgerReason.TOPUP_MONTHLY,
          creditProductId: validated.creditProductId,
          subscriptionId: sub.id,
          createdByUserId: session.user.id,
        },
      })

      // 5. Update balance atomically
      await tx.clientCreditAccount.update({
        where: { clientId: validated.clientId },
        data: { balance: { increment: validated.monthlyCredits } },
      })

      return { subscription: sub }
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CREDIT_SUBSCRIBE",
      targetType: "credit_subscription",
      targetId: subscription.id,
      details: {
        clientId: validated.clientId,
        creditProductId: validated.creditProductId,
        monthlyCredits: validated.monthlyCredits,
        startDate: validated.startDate,
      },
    })

    return NextResponse.json(subscription, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    if (error instanceof Error && error.message.includes("not found or inactive")) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error("Error subscribing client:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
