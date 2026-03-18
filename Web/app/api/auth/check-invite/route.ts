import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/lib/security/rate-limit"

function getRequestIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown"
  }
  return req.headers.get("x-real-ip") || "unknown"
}

// GET /api/auth/check-invite?email=user@example.com
// Public endpoint to check if an email has pending invites
export async function GET(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`check-invite:${getRequestIp(req)}`, RATE_LIMITS.login)
    if (!rateLimit.success) {
      const response = NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
      const headers = getRateLimitHeaders(rateLimit)
      Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
      return response
    }

    const searchParams = req.nextUrl.searchParams
    const email = searchParams.get("email")

    if (!email) {
      return NextResponse.json(
        { error: "Email parameter is required" },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    const [coachInviteCount, cohortInviteCount] = await Promise.all([
      db.coachInvite.count({
        where: { email: normalizedEmail },
      }),
      db.cohortInvite.count({
        where: { email: normalizedEmail },
      }),
    ])

    return NextResponse.json(
      { hasInvite: coachInviteCount > 0 || cohortInviteCount > 0 },
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
