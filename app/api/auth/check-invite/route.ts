import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"

// GET /api/auth/check-invite?email=user@example.com
// Public endpoint to check if an email has pending invites
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      )
    }

    // Check for pending CoachInvite records
    const pendingInvites = await db.coachInvite.findMany({
      where: { email: email.toLowerCase() },
    })

    return NextResponse.json(
      { hasInvite: pendingInvites.length > 0 },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error checking invite:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
