import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Lightweight JWT parsing without any NextAuth imports
// This keeps the middleware bundle under 1MB Edge Function limit
function parseJWT(token: string): any {
  try {
    const base64Url = token.split('.')[1]
    if (!base64Url) return null
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

/**
 * Add CORS headers for iOS HealthKit ingestion endpoints.
 * These endpoints need to be accessible from the iOS app.
 */
function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Max-Age', '86400') // 24 hours
  return response
}

/**
 * Check if this is a HealthKit ingestion endpoint that needs CORS
 */
function isHealthKitEndpoint(pathname: string): boolean {
  return pathname.startsWith('/api/ingest') || pathname.startsWith('/api/pair')
}

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Allow all public assets (images, etc.) to bypass middleware
  if (
    pathname.startsWith('/public/') ||
    pathname.match(/^\/.+\.(png|jpg|jpeg|svg|gif|ico|webp|avif|bmp)$/)
  ) {
    return NextResponse.next()
  }

  // Handle CORS preflight for HealthKit endpoints
  if (isHealthKitEndpoint(pathname)) {
    if (req.method === 'OPTIONS') {
      // Handle preflight request
      const response = new NextResponse(null, { status: 200 })
      return addCorsHeaders(response)
    }
  }

  // Public routes - allow access (no auth check needed)
  if (
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/coach-dashboard") ||
    pathname.startsWith("/client-dashboard") ||
    pathname.startsWith("/cohorts") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/api/onboarding")
  ) {
    return NextResponse.next()
  }

  // HealthKit ingestion endpoints - allow access with CORS (auth handled in route handlers)
  if (isHealthKitEndpoint(pathname)) {
    const response = NextResponse.next()
    return addCorsHeaders(response)
  }

  // For API routes, if we can't parse the JWT properly, let NextAuth handle it
  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  // Get JWT token from cookies (lightweight, no NextAuth import needed)
  const tokenCookie = req.cookies.get('next-auth.session-token') || 
                      req.cookies.get('__Secure-next-auth.session-token')
  
  // Protected routes require authentication
  if (!tokenCookie) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Parse JWT token to get user roles
  const tokenData = parseJWT(tokenCookie.value)
  const userRoles = (tokenData?.roles as string[]) || []

  // Determine if user is a coach/admin or client
  const isCoach = userRoles.includes("COACH") || userRoles.includes("ADMIN")
  const isClient = userRoles.includes("CLIENT")

  // API routes - check roles for API access
  if (pathname.startsWith("/api/entries")) {
    if (!isClient) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
  }

  if (
    pathname.startsWith("/api/cohorts") ||
    pathname.startsWith("/api/clients") ||
    pathname.startsWith("/api/coach-dashboard") ||
    pathname.startsWith("/api/invites")
  ) {
    if (!isCoach) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
  }

  if (pathname.startsWith("/api/admin")) {
    if (!userRoles.includes("ADMIN")) {
      return NextResponse.redirect(new URL("/login", req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|public/|.*\\.(png|jpg|jpeg|svg|gif|ico|webp|avif|bmp)).*)",
  ],
}
