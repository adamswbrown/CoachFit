import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/permissions"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    // Optimize: Use select to only get needed fields and batch relations
    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        isTestUser: true,
        createdAt: true,
        passwordHash: true,
        Account: {
          select: {
            provider: true,
          },
        },
        CohortMembership: {
          select: {
            Cohort: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        Cohort: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      // Add pagination support for large datasets (optional, can be added later)
      // take: 100,
      // skip: 0,
    })

    const formattedUsers = users.map((user: { id: string; email: string; name: string | null; roles: string[]; isTestUser: boolean; createdAt: Date; passwordHash: string | null; Account: { provider: string }[]; CohortMembership: { Cohort: { id: string; name: string } }[]; Cohort: { id: string; name: string }[] }) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      roles: user.roles,
      isTestUser: user.isTestUser,
      createdAt: user.createdAt,
      hasPassword: !!user.passwordHash,
      authProviders: user.Account.map((a: { provider: string }) => a.provider),
      cohortsMemberOf: user.CohortMembership.map((m: { Cohort: { id: string; name: string } }) => ({
        id: m.Cohort.id,
        name: m.Cohort.name,
      })),
      cohortsCoaching: user.Cohort.map((c: { id: string; name: string }) => ({
        id: c.id,
        name: c.name,
      })),
    }))

    return NextResponse.json({ users: formattedUsers }, { status: 200 })
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
