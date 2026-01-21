import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isClient } from "@/lib/permissions"
import { getSystemSetting } from "@/lib/system-settings"

/**
 * GET /api/onboarding/config
 * Returns onboarding configuration flags for clients
 */
export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isClient(session.user)) {
    return NextResponse.json({ error: "Only clients can view onboarding config" }, { status: 403 })
  }

  try {
    const showPersonalizedPlan = await getSystemSetting("showPersonalizedPlan")
    return NextResponse.json({ data: { showPersonalizedPlan } }, { status: 200 })
  } catch (error) {
    console.error("Error fetching onboarding config:", error)
    return NextResponse.json(
      { data: { showPersonalizedPlan: true } },
      { status: 200 }
    )
  }
}
