import { auth } from "@/lib/auth"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { Role } from "@/lib/types"

export default auth((req) => {
  const session = req.auth
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

  // Protected routes require authentication
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const userRoles = (session.user?.roles as Role[]) || []

  // Client routes
  if (pathname.startsWith("/api/entries") || pathname === "/client-dashboard") {
    if (!userRoles.includes(Role.CLIENT)) {
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
    if (!userRoles.includes(Role.COACH)) {
      return NextResponse.redirect(new URL("/client-dashboard", req.url))
    }
  }

  // Admin routes
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    if (!userRoles.includes(Role.ADMIN)) {
      return NextResponse.redirect(new URL("/coach-dashboard", req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
