import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { isAdminOrCoach } from "@/lib/permissions"
import { getBalance } from "@/lib/credits"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const searchParams = req.nextUrl.searchParams
    const queryClientId = searchParams.get("clientId")

    // Clients can only view their own balance.
    // Coaches/admins can specify ?clientId= to view any client's balance.
    let clientId: string
    if (queryClientId) {
      if (!isAdminOrCoach(session.user)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
      clientId = queryClientId
    } else {
      clientId = session.user.id
    }

    const balance = await getBalance(clientId)
    return NextResponse.json({ clientId, balance }, { status: 200 })
  } catch (error) {
    console.error("Error fetching credit balance:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
