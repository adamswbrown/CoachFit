import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// Use getToken instead of full auth() to reduce bundle size
// This avoids importing Prisma, database connections, and other heavy dependencies
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

  // Get token from JWT (lighter than full auth check)
  const token = await getToken({ 
    req,
    secret: process.env.NEXTAUTH_SECRET 
  })

  // Protected routes require authentication
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  // Get user roles from token
  const userRoles = (token.roles as string[]) || []

  // Client routes
  if (pathname.startsWith("/api/entries") || pathname === "/client-dashboard") {
    if (!userRoles.includes("CLIENT")) {
      return NextResponse.redirect(new URL("/coach-dashboard", req.url))
    }
  }

  // Coach routes
  if (
    pathname.startsWith("/api/cohorts") ||
    pathname.startsWith("/api/clients") ||
    pathname.startsWith("/cohorts") ||
    pathname.startsWith("/clients") ||
    pathname === "/coach-dashboard"
  ) {
    if (!userRoles.includes("COACH")) {
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
