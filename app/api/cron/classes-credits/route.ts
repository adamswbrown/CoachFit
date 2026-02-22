import { NextRequest, NextResponse } from "next/server"
import { runMonthlyCreditTopupAndExpiry } from "@/lib/classes-service"

function hasCronAccess(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return process.env.NODE_ENV !== "production"
  }

  const authHeader = req.headers.get("authorization")
  const xSecret = req.headers.get("x-cron-secret")

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice("Bearer ".length)
    if (token === secret) return true
  }

  return xSecret === secret
}

export async function POST(req: NextRequest) {
  try {
    if (!hasCronAccess(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const runAt = body?.runAt ? new Date(body.runAt) : new Date()

    const result = await runMonthlyCreditTopupAndExpiry({
      runAt,
      actorUserId: null,
    })

    return NextResponse.json(
      {
        ok: true,
        runAt: runAt.toISOString(),
        ...result,
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error executing monthly credit job:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
