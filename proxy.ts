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

// Lightweight JWT parsing without any NextAuth imports to stay under the Edge bundle limit.
function parseJWT(token: string): { roles?: string[]; exp?: number } | null {
  try {
    const base64Url = token.split(".")[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/")
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

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

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Static files - pass through
  if (
    pathname.startsWith("/public/") ||
    pathname.match(/^\/.+\.(png|jpg|jpeg|svg|gif|ico|webp|avif|bmp)$/)
  ) {
    return NextResponse.next()
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
    const tokenCookie =
      req.cookies.get("next-auth.session-token") ||
      req.cookies.get("__Secure-next-auth.session-token")

    if (!tokenCookie) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      )
    }

    const tokenData = parseJWT(tokenCookie.value)

    if (!tokenData) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Invalid session" }, { status: 401 })
      )
    }

    // Check token expiration
    if (tokenData.exp && Date.now() >= tokenData.exp * 1000) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Session expired" }, { status: 401 })
      )
    }

    const userRoles = tokenData.roles || []
    const isCoach = userRoles.includes("COACH") || userRoles.includes("ADMIN")
    const isAdminUser = userRoles.includes("ADMIN")

    // Admin routes
    if (pathname.startsWith("/api/admin") && !isAdminUser) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
      )
    }

    // Coach routes
    if (
      pathname.startsWith("/api/cohorts") ||
      pathname.startsWith("/api/clients") ||
      pathname.startsWith("/api/coach-dashboard") ||
      pathname.startsWith("/api/coach/") ||
      pathname.startsWith("/api/invites") ||
      pathname.startsWith("/api/pairing-codes")
    ) {
      if (!isCoach) {
        return addSecurityHeaders(
          NextResponse.json({ error: "Forbidden: Coach access required" }, { status: 403 })
        )
      }
    }

    return addSecurityHeaders(NextResponse.next())
  }

  // Page routes - check authentication for protected pages
  const tokenCookie =
    req.cookies.get("next-auth.session-token") ||
    req.cookies.get("__Secure-next-auth.session-token")

  if (!tokenCookie) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
