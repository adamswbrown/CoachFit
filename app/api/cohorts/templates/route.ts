import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { isAdminOrCoach } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const ownerId = searchParams.get("ownerId")

    const whereClause = session.user.roles.includes(Role.ADMIN)
      ? ownerId
        ? { coachId: ownerId }
        : {}
      : {
          OR: [
            { coachId: session.user.id },
            { coachMemberships: { some: { coachId: session.user.id } } },
          ],
        }

    const cohorts = await db.cohort.findMany({
      where: {
        AND: [
          whereClause,
          {
            name: {
              startsWith: "Template:",
            },
          },
        ],
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const templates = cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      createdAt: cohort.createdAt,
      coachId: cohort.User.id,
      coachName: cohort.User.name,
      coachEmail: cohort.User.email,
    }))

    return NextResponse.json(templates, { status: 200 })
  } catch (error) {
    console.error("Error fetching cohort templates:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
