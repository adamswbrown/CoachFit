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

    if (!isCoach && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

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
          { error: "Forbidden: Client not in your cohorts" },
          { status: 403 }
        )
      }
    }

    const client = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        onboardingComplete: true,
        gender: true,
        dateOfBirth: true,
        activityLevel: true,
        primaryGoal: true,
        UserGoals: {
          select: {
            currentWeightKg: true,
            targetWeightKg: true,
            heightCm: true,
          },
        },
        UserPreference: {
          select: {
            weightUnit: true,
            measurementUnit: true,
            dateFormat: true,
          },
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    return NextResponse.json(client, { status: 200 })
  } catch (error) {
    console.error("Error fetching onboarding answers:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
