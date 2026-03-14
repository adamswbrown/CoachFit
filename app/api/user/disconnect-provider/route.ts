import { getSession } from "@/lib/auth"
import { NextResponse } from "next/server"

/**
 * Provider disconnection is now managed by Clerk.
 * This endpoint returns a message directing users to Clerk's account settings.
 */
export async function POST(request: Request) {
  const session = await getSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return NextResponse.json(
    {
      error:
        "OAuth provider management has moved to Clerk. Please use your Clerk account settings to connect or disconnect providers.",
    },
    { status: 400 }
  )
}
