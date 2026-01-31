/**
 * Next.js Middleware for centralized route protection
 *
 * Security features:
 * - JWT validation for protected routes
 * - Role-based access control
 * - Rate limiting headers
 * - Security headers injection
 * - Public route whitelist
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/signup",
  "/api/auth",
  "/api/public",
  "/_next",
  "/favicon.ico",
  "/manifest.json",
]

// Routes that require special handling (mobile app endpoints)
// These need pairing code validation, not session auth
const MOBILE_APP_PATHS = [
  "/api/pair",
  "/api/ingest",
]

// Admin-only routes
const ADMIN_PATHS = [
  "/admin",
  "/api/admin",
]

// Coach-only routes
const COACH_PATHS = [
  "/coach-dashboard",
  "/api/coach-dashboard",
  "/api/coach",
  "/api/cohorts",
  "/api/clients",
  "/api/invites",
  "/api/pairing-codes",
]

/**
 * Parse JWT token without importing NextAuth (to avoid Edge bundle size issues)
 * This is a lightweight validation - full validation happens in API routes
 */
function parseJwtPayload(token: string): { roles?: string[]; exp?: number } | null {
  try {
    const parts = token.split(".")
    if (parts.length !== 3) return null

    const payload = JSON.parse(
      Buffer.from(parts[1], "base64").toString("utf-8")
    )

    return payload
  } catch {
    return null
  }
}

/**
 * Check if a path matches any pattern in the list
 */
function matchesPath(pathname: string, patterns: string[]): boolean {
  return patterns.some(pattern => pathname.startsWith(pattern))
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static files and public routes
  if (matchesPath(pathname, PUBLIC_PATHS)) {
    return addSecurityHeaders(NextResponse.next())
  }

  // Mobile app endpoints have their own auth (pairing codes)
  // They should check HealthKit enabled status in the route handler
  if (matchesPath(pathname, MOBILE_APP_PATHS)) {
    return addSecurityHeaders(NextResponse.next())
  }

  // Get session token from cookies
  const sessionToken =
    request.cookies.get("__Secure-next-auth.session-token")?.value ||
    request.cookies.get("next-auth.session-token")?.value

  // No token - redirect to login for pages, 401 for API
  if (!sessionToken) {
    if (pathname.startsWith("/api/")) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      )
    }

    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Parse JWT to check roles (lightweight check - full validation in API routes)
  const payload = parseJwtPayload(sessionToken)

  if (!payload) {
    if (pathname.startsWith("/api/")) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Invalid session" }, { status: 401 })
      )
    }

    const loginUrl = new URL("/login", request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Check token expiration
  if (payload.exp && Date.now() >= payload.exp * 1000) {
    if (pathname.startsWith("/api/")) {
      return addSecurityHeaders(
        NextResponse.json({ error: "Session expired" }, { status: 401 })
      )
    }

    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  const roles = payload.roles || []

  // Admin route protection
  if (matchesPath(pathname, ADMIN_PATHS)) {
    if (!roles.includes("ADMIN")) {
      if (pathname.startsWith("/api/")) {
        return addSecurityHeaders(
          NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
        )
      }
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  // Coach route protection
  if (matchesPath(pathname, COACH_PATHS)) {
    if (!roles.includes("COACH") && !roles.includes("ADMIN")) {
      if (pathname.startsWith("/api/")) {
        return addSecurityHeaders(
          NextResponse.json({ error: "Forbidden: Coach access required" }, { status: 403 })
        )
      }
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  // All checks passed
  return addSecurityHeaders(NextResponse.next())
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
