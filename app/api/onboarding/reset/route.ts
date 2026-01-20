import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { NextResponse } from "next/server"

/**
 * POST /api/onboarding/reset
 * Resets onboarding by clearing UserGoals but preserving UserPreference
 * Sets onboardingComplete to false so user sees onboarding flow again
 */
export async function POST() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isClient(session.user)) {
    return NextResponse.json({ error: "Only clients can reset onboarding" }, { status: 403 })
  }

  try {
    const result = await db.$transaction(async (tx) => {
      // Mark onboarding as incomplete
      const user = await tx.user.update({
        where: { id: session.user.id },
        data: {
          onboardingComplete: false,
        },
        select: { id: true, email: true },
      })

      // Delete UserGoals (will be recreated when user re-completes onboarding)
      await tx.userGoals.delete({
        where: { userId: session.user.id },
      }).catch(() => {
        // It's okay if UserGoals doesn't exist
      })

      // UserPreference is preserved (unit choice stays the same)
      const preference = await tx.userPreference.findUnique({
        where: { userId: session.user.id },
      })

      return { user, preference }
    })

    return NextResponse.json({
      data: {
        message: "Onboarding reset successfully",
        onboardingComplete: false,
        unitPreferencePreserved: !!result.preference,
      },
    })
  } catch (error) {
    console.error("Error resetting onboarding:", error)
    return NextResponse.json(
      { error: "Failed to reset onboarding" },
      { status: 500 }
    )
  }
}
