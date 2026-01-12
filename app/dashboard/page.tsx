import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Role } from "@/lib/types"
import { detectOnboardingState, getOnboardingRoute } from "@/lib/onboarding"

export default async function DashboardPage() {
  const session = await auth()

  if (!session || !session.user) {
    redirect("/login")
  }

  // Check onboarding status first
  try {
    const state = await detectOnboardingState(session.user.id)
    
    // If user not found in database, redirect to login to clear stale session
    if (!state) {
      redirect("/login?error=session_expired")
    }
    
    const onboardingRoute = getOnboardingRoute(state)
    
    if (onboardingRoute !== "/dashboard") {
      redirect(onboardingRoute)
    }
  } catch (error: any) {
    // NEXT_REDIRECT is not an error - it's how Next.js handles redirects
    // Re-throw redirect errors so they work correctly
    if (error?.digest?.startsWith('NEXT_REDIRECT') || error?.message === 'NEXT_REDIRECT') {
      throw error
    }
    console.error("Error detecting onboarding state:", error)
    // Fallback to login if detection fails
    redirect("/login?error=session_expired")
  }

  // If onboarding complete, redirect based on role
  // This will execute if onboarding check passes or fails
  if (session.user.roles.includes(Role.ADMIN)) {
    redirect("/admin")
  } else if (session.user.roles.includes(Role.COACH)) {
    redirect("/coach-dashboard")
  } else if (session.user.roles.includes(Role.CLIENT)) {
    redirect("/client-dashboard")
  }

  redirect("/login")
}
