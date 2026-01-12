import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

/**
 * POST /api/onboarding/complete
 * Marks the current user's onboarding as complete
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Update user's onboarding status
    await db.user.update({
      where: { id: session.user.id },
      data: { onboardingComplete: true },
    })

    return NextResponse.json(
      { message: "Onboarding completed successfully" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error completing onboarding:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
