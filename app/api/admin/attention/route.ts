import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { AttentionScoreCalculator } from "@/lib/admin/attention"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const calculator = new AttentionScoreCalculator()
    const refresh = req.nextUrl.searchParams.get("refresh") === "1"
    const attentionQueue = await calculator.calculateAttentionQueue({ forceRefresh: refresh })

    return NextResponse.json(
      {
        red: attentionQueue.red,
        amber: attentionQueue.amber,
        green: attentionQueue.green,
        summary: {
          red: attentionQueue.red.length,
          amber: attentionQueue.amber.length,
          green: attentionQueue.green.length,
          total: attentionQueue.red.length + attentionQueue.amber.length + attentionQueue.green.length,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching attention queue:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
