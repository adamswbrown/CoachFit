/**
 * Next.js 16 Proxy for centralized route protection (Clerk + custom logic)
 *
 * Security features:
 * - Clerk session validation for protected routes
 * - Security headers injection
 * - Public route whitelist
 * - Proper CORS for mobile endpoints (with authentication required at route level)
 */

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server"
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
    "camera=(), microphone=(), geolocation=()"
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

/**
 * Routes that don't require Clerk authentication.
 * Clerk middleware still runs on these routes but won't block unauthenticated users.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/signup(.*)",
  "/dashboard",
  "/api/auth(.*)",
  "/api/public(.*)",
  "/api/webhooks(.*)",
  "/api/ingest(.*)",
  "/api/pair(.*)",
  "/api/healthkit(.*)",
  "/public/(.*)",
])

export default clerkMiddleware(async (auth, req) => {
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

  // Protected routes - require Clerk authentication
  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  return addSecurityHeaders(NextResponse.next())
})

export const config = {
  matcher: [
    // Skip Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.json|sw.js|workbox-.*\\.js).*)",
  ],
}
