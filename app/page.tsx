import { redirect } from "next/navigation"
import { auth as getAuth } from "@/lib/auth"
import { detectOnboardingState, getOnboardingRoute } from "@/lib/onboarding"

export default async function HomePage() {
  const session = await getAuth()

  if (!session || !session.user) {
    redirect("/login")
  }

  // Check onboarding status and redirect accordingly
  try {
    const state = await detectOnboardingState(session.user.id)
    const onboardingRoute = getOnboardingRoute(state)
    
    if (onboardingRoute !== "/dashboard") {
      redirect(onboardingRoute)
    }
  } catch (error) {
    console.error("Error detecting onboarding state:", error)
    // Fallback to dashboard if detection fails
  }

  // If onboarding complete, redirect to dashboard (which will route to appropriate dashboard)
  redirect("/dashboard")
}
