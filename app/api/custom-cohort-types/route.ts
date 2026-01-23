import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdminOrCoach } from "@/lib/permissions"
import { db } from "@/lib/db"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const search = searchParams.get("search")?.trim()

    const types = await db.customCohortType.findMany({
      where: search
        ? {
            label: {
              contains: search,
              mode: "insensitive",
            },
          }
        : undefined,
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ types }, { status: 200 })
  } catch (error) {
    console.error("Error fetching custom cohort types:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
