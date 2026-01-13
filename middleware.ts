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

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  // Public routes - allow access (no auth check needed)
  if (
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/dashboard" ||
    pathname === "/admin" ||
    pathname === "/coach-dashboard" ||
    pathname === "/client-dashboard" ||
    pathname.startsWith("/cohorts") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/api/onboarding")
  ) {
    return NextResponse.next()
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
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
