import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { detectOnboardingState, getOnboardingRoute } from "@/lib/onboarding"

/**
 * GET /api/onboarding/detect-state
 * Returns the appropriate onboarding route for the current user based on their
 * account origin (invited vs self-signup) and role.
 */
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const state = await detectOnboardingState(session.user.id)

    if (!state) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const route = getOnboardingRoute(state)

    return NextResponse.json({ route, state })
  } catch (error) {
    console.error("Error detecting onboarding state:", error)
    return NextResponse.json(
      { error: "Failed to detect onboarding state" },
      { status: 500 }
    )
  }
}
