import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"
import { Role } from "@/lib/types"

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

    // Only coaches or admins can view client plans
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // If coach, must own at least one cohort with this client
    if (session.user.roles.includes(Role.COACH) && !session.user.roles.includes(Role.ADMIN)) {
      const membership = await db.cohortMembership.findFirst({
        where: {
          userId: id,
          Cohort: { coachId: session.user.id },
        },
      })
      if (!membership) {
        return NextResponse.json({ error: "Forbidden: Not your client" }, { status: 403 })
      }
    }

    // Fetch plan from UserGoals
    const userGoals = await db.userGoals.findUnique({
      where: { userId: id },
      select: {
        dailyCaloriesKcal: true,
        proteinGrams: true,
        carbGrams: true,
        fatGrams: true,
        waterIntakeMl: true,
        dailyStepsTarget: true,
        weeklyWorkoutMinutes: true,
        currentWeightKg: true,
        targetWeightKg: true,
        heightCm: true,
      },
    })

    if (!userGoals) {
      return NextResponse.json({ error: "No personalized plan found for this client." }, { status: 404 })
    }

    return NextResponse.json({ plan: userGoals }, { status: 200 })
  } catch (error) {
    console.error("Error fetching client plan:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
