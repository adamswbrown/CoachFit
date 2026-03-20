import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth"
import { Role } from "@/lib/types"

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const session = await getSession()

  if (!session?.user) {
    redirect("/login")
  }

  const user = session.user
  const userRoles = user.roles || []

  if (user.mustChangePassword) {
    redirect("/client-dashboard/settings")
  }

  if (userRoles.includes(Role.COACH)) {
    redirect("/coach-dashboard")
  } else if (userRoles.includes(Role.ADMIN)) {
    redirect("/admin")
  } else if (userRoles.includes(Role.CLIENT)) {
    if (!user.onboardingComplete) {
      redirect("/onboarding/client")
    }
    redirect("/client-dashboard")
  }

  redirect("/client-dashboard")
}
