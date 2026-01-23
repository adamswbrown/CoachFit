import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"
import { AttentionScoreCalculator } from "@/lib/admin/attention"
import { logAuditAction } from "@/lib/audit-log"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const batchSize = typeof body?.batchSize === "number" ? body.batchSize : 200

    const clients = await db.user.findMany({
      where: {
        roles: {
          has: "CLIENT",
        },
      },
      select: {
        id: true,
      },
    })

    const ids = clients.map((client) => client.id)
    const calculator = new AttentionScoreCalculator()
    await calculator.recalculateClientAttention(ids, batchSize)

    await logAuditAction({
      actor: session.user,
      actionType: "ADMIN_REFRESH_ATTENTION",
      targetType: "attention_scores",
      details: {
        totalClients: ids.length,
        batchSize,
      },
    })

    return NextResponse.json(
      { updated: ids.length, batchSize },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error refreshing attention scores:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
