import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { getSystemSettings } from "@/lib/system-settings"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const settings = await getSystemSettings()

    return NextResponse.json(
      {
        data: {
          healthkitEnabled: settings.healthkitEnabled,
          iosIntegrationEnabled: settings.iosIntegrationEnabled,
          classBookingEnabled: settings.classBookingEnabled,
        },
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error fetching feature flags:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
