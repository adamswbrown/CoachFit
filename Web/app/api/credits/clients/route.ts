import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach, isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    let userWhereClause: any

    if (isAdmin(session.user)) {
      // Admin: all clients
      userWhereClause = {
        roles: { has: Role.CLIENT },
      }
    } else {
      // Coach: clients in their cohorts
      const coachCohorts = await db.cohort.findMany({
        where: {
          OR: [
            { coachId: session.user.id },
            { coachMemberships: { some: { coachId: session.user.id } } },
          ],
        },
        select: { id: true },
      })
      const cohortIds = coachCohorts.map((c) => c.id)

      userWhereClause = {
        roles: { has: Role.CLIENT },
        CohortMembership: {
          some: { cohortId: { in: cohortIds } },
        },
      }
    }

    const clients = await db.user.findMany({
      where: userWhereClause,
      select: {
        id: true,
        name: true,
        email: true,
        ClientCreditAccount: {
          select: { balance: true },
        },
      },
      orderBy: { name: "asc" },
    })

    const result = clients.map((client) => ({
      id: client.id,
      name: client.name,
      email: client.email,
      balance: client.ClientCreditAccount?.balance ?? 0,
    }))

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("Error fetching clients with credit balances:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
