import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach, isAdmin } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const statusFilter = searchParams.get("status") ?? undefined

    // Build where clause:
    // - Coach: sees submissions for products they own
    // - Admin: sees all submissions
    let whereClause: any = {}

    if (statusFilter) {
      whereClause.status = statusFilter
    }

    if (!isAdmin(session.user)) {
      // Coach: only submissions for their own credit products
      whereClause.creditProduct = {
        ownerCoachId: session.user.id,
      }
    }

    const submissions = await db.creditSubmission.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        client: {
          select: { id: true, name: true, email: true },
        },
        creditProduct: {
          select: {
            id: true,
            name: true,
            creditsPerPeriod: true,
            purchasePriceGbp: true,
            currency: true,
          },
        },
      },
    })

    return NextResponse.json(submissions, { status: 200 })
  } catch (error) {
    console.error("Error fetching credit submissions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
