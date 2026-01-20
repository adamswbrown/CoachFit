import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { NextResponse } from "next/server"

/**
 * GET /api/onboarding/status
 * Returns onboarding completion status for current user
 */
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isClient(session.user)) {
    return NextResponse.json({ error: "Only clients can check onboarding status" }, { status: 403 })
  }

  try {
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        onboardingComplete: true,
        UserGoals: true,
        UserPreference: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({
      data: {
        onboardingComplete: user.onboardingComplete,
        hasGoals: !!user.UserGoals,
        hasPreference: !!user.UserPreference,
      },
    })
  } catch (error) {
    console.error("Error fetching onboarding status:", error)
    return NextResponse.json({ error: "Failed to fetch status" }, { status: 500 })
  }
}
