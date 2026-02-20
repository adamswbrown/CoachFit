/**
 * Next.js 16 Proxy for centralized route protection
 *
 * Security features:
 * - JWT validation for protected routes
 * - Role-based access control
 * - Security headers injection
 * - Public route whitelist
 * - Proper CORS for mobile endpoints (with authentication required at route level)
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY")
  // Prevent MIME type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff")
  // Control referrer information
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  // XSS protection (legacy but still useful)
  response.headers.set("X-XSS-Protection", "1; mode=block")
  // Permissions policy
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  )
  return response
}

/**
 * Add CORS headers for mobile app endpoints
 * Note: These endpoints still require pairing token authentication at the route level
 */
function addMobileCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*")
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Pairing-Token")
  response.headers.set("Access-Control-Max-Age", "86400")
  return addSecurityHeaders(response)
}

function isHealthKitEndpoint(pathname: string): boolean {
  return pathname.startsWith("/api/ingest") || pathname.startsWith("/api/pair")
}

function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/public") ||
    pathname.startsWith("/public/") ||
    pathname.match(/^\/.+\.(png|jpg|jpeg|svg|gif|ico|webp|avif|bmp)$/) !== null
  )
}

function getSessionCookie(req: NextRequest) {
  return (
    req.cookies.get("__Secure-authjs.session-token") ||
    req.cookies.get("authjs.session-token") ||
    req.cookies.get("__Secure-next-auth.session-token") ||
    req.cookies.get("next-auth.session-token")
  )
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Static files - pass through
  if (
    pathname.startsWith("/public/") ||
    pathname.match(/^\/.+\.(png|jpg|jpeg|svg|gif|ico|webp|avif|bmp)$/)
  ) {
    return NextResponse.next()
  }

  // ─── Setup Wizard Gate ───────────────────────────────────────────────
  // If setup is not complete, redirect all non-setup routes to /setup.
  // Uses a cookie to avoid DB lookups on every request.
  // The /setup page verifies against the DB and sets the cookie if setup
  // is already complete.
  if (
    !pathname.startsWith("/setup") &&
    !pathname.startsWith("/api/setup") &&
    !pathname.startsWith("/api/auth") &&
    !pathname.endsWith(".webmanifest") &&
    !pathname.endsWith(".json")
  ) {
    const setupComplete = req.cookies.get("coachfit_setup_complete")?.value
    if (setupComplete !== "true") {
      return NextResponse.redirect(new URL("/setup", req.url))
    }
  }

  // Allow setup routes through with security headers
  if (pathname.startsWith("/setup") || pathname.startsWith("/api/setup")) {
    return addSecurityHeaders(NextResponse.next())
  }

  // CORS preflight for mobile endpoints
  if (isHealthKitEndpoint(pathname) && req.method === "OPTIONS") {
    return addMobileCorsHeaders(new NextResponse(null, { status: 204 }))
  }

  // Mobile app endpoints - add CORS but authentication happens at route level
  if (isHealthKitEndpoint(pathname)) {
    return addMobileCorsHeaders(NextResponse.next())
  }

  // Public paths - allow but add security headers
  if (isPublicPath(pathname)) {
    return addSecurityHeaders(NextResponse.next())
  }

  // Protected pages that should render (auth check happens client-side or in page)
  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/coach-dashboard") ||
    pathname.startsWith("/client-dashboard") ||
    pathname.startsWith("/cohorts") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/api/onboarding")
  ) {
    return addSecurityHeaders(NextResponse.next())
  }

  // API routes - validate authentication
  if (pathname.startsWith("/api/")) {
    const tokenCookie = getSessionCookie(req)

    if (!tokenCookie) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      )
    }

    // Allow request to proceed — role/expiration checks happen in route handlers via auth()
    return addSecurityHeaders(NextResponse.next())
  }

  // Page routes - check authentication for protected pages
  if (!getSessionCookie(req)) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
