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
    // Fallback to role-based routing if detection fails
    // Continue to role-based redirects below
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
