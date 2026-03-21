import { NextRequest, NextResponse } from "next/server"
import { getSessionWithMobile } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"
import { creditLedgerQuerySchema } from "@/lib/validations/credits"
import { z } from "zod"

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionWithMobile()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const rawQuery = {
      clientId: searchParams.get("clientId") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    }

    const query = creditLedgerQuerySchema.parse(rawQuery)

    // Clients see only their own ledger.
    // Coaches/admins can query any client via ?clientId=
    let clientId: string
    if (query.clientId) {
      if (!isAdminOrCoach(session.user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      clientId = query.clientId
    } else {
      clientId = session.user.id
    }

    const skip = (query.page - 1) * query.limit

    const [entries, total] = await Promise.all([
      db.clientCreditLedger.findMany({
        where: { clientId },
        orderBy: { createdAt: "desc" },
        skip,
        take: query.limit,
        include: {
          creditProduct: { select: { id: true, name: true } },
          submission: { select: { id: true, status: true } },
          booking: { select: { id: true, sessionId: true } },
          subscription: { select: { id: true, creditProductId: true } },
        },
      }),
      db.clientCreditLedger.count({ where: { clientId } }),
    ])

    return NextResponse.json(
      {
        entries,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error fetching credit ledger:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
