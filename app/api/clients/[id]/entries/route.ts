import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { isAdmin } from "@/lib/permissions"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isCoach = session.user.roles.includes(Role.COACH)
    const isAdminUser = isAdmin(session.user)

    // Must be COACH or ADMIN
    if (!isCoach && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify client exists
    const client = await db.user.findUnique({
      where: { id },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Authorization: If COACH, verify client is in at least one cohort owned by coach
    if (isCoach && !isAdminUser) {
      const membership = await db.cohortMembership.findFirst({
        where: {
          userId: id,
          Cohort: {
            coachId: session.user.id,
          },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: "Client not in your cohorts" },
          { status: 403 }
        )
      }
    }

    const searchParams = req.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const skip = (page - 1) * limit

    const entries = await db.entry.findMany({
      where: {
        userId: id,
      },
      select: {
        id: true,
        userId: true,
        date: true,
        weightLbs: true,
        steps: true,
        calories: true,
        heightInches: true,
        sleepQuality: true,
        perceivedStress: true,
        notes: true,
        customResponses: true,
        dataSources: true, // Include data source indicator
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        date: "desc",
      },
      skip,
      take: limit,
    })

    return NextResponse.json(entries, { status: 200 })
  } catch (error) {
    console.error("Error fetching client entries:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
