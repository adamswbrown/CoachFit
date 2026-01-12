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

  // Public routes - allow access
  if (
    pathname === "/" ||
    pathname.startsWith("/api/auth") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/api/onboarding")
  ) {
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

  // Client routes
  if (pathname.startsWith("/api/entries") || pathname === "/client-dashboard") {
    if (!userRoles.includes("CLIENT")) {
      return NextResponse.redirect(new URL("/coach-dashboard", req.url))
    }
  }

  // Coach routes - allow both COACH and ADMIN
  if (
    pathname.startsWith("/api/cohorts") ||
    pathname.startsWith("/api/clients") ||
    pathname.startsWith("/cohorts") ||
    pathname.startsWith("/clients") ||
    pathname === "/coach-dashboard" ||
    pathname.startsWith("/api/coach-dashboard") ||
    pathname.startsWith("/api/invites")
  ) {
    // Allow COACH or ADMIN to access coach routes
    if (!userRoles.includes("COACH") && !userRoles.includes("ADMIN")) {
      return NextResponse.redirect(new URL("/client-dashboard", req.url))
    }
  }

  // Admin routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!userRoles.includes("ADMIN")) {
      return NextResponse.redirect(new URL("/coach-dashboard", req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
