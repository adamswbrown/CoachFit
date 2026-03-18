import { NextRequest, NextResponse } from "next/server"
import { createClerkClient } from "@clerk/nextjs/server"

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
})

/**
 * Mobile handoff endpoint.
 *
 * The iOS app calls this URL in Safari with a Clerk session JWT.
 * We verify the token, set the __session cookie (which Clerk middleware reads),
 * and redirect to the target page — so the user lands already authenticated.
 *
 * GET /api/auth/mobile-handoff?token=<jwt>&redirect=<path>
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const token = searchParams.get("token")
  const redirect = searchParams.get("redirect") || "/client-dashboard"

  if (!token) {
    return NextResponse.json({ error: "Missing token parameter" }, { status: 400 })
  }

  // Verify the JWT is valid
  try {
    await clerk.verifyToken(token)
  } catch {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 })
  }

  // Build the redirect URL (only allow relative paths to prevent open redirect)
  const redirectPath = redirect.startsWith("/") ? redirect : `/${redirect}`
  const baseUrl = request.nextUrl.origin
  const redirectUrl = new URL(redirectPath, baseUrl)

  const response = NextResponse.redirect(redirectUrl)

  // Set the __session cookie that Clerk middleware reads
  response.cookies.set("__session", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    // Short-lived — matches Clerk JWT lifetime (typically 60s)
    // Clerk will refresh it via its client-side SDK once the page loads
    maxAge: 300,
  })

  return response
}
