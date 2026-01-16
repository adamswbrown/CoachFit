import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Lightweight JWT parsing without any NextAuth imports to stay under the Edge bundle limit.
function parseJWT(token: string): any {
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

// Add CORS headers for iOS HealthKit ingestion endpoints so the iOS app can call them directly.
function addCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*")
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization")
  response.headers.set("Access-Control-Max-Age", "86400") // 24 hours
  return response
}

function isHealthKitEndpoint(pathname: string): boolean {
  return pathname.startsWith("/api/ingest") || pathname.startsWith("/api/pair")
}

export async function proxy(req: NextRequest) {
  const pathname = req.nextUrl.pathname

  if (
    pathname.startsWith("/public/") ||
    pathname.match(/^\/.+\.(png|jpg|jpeg|svg|gif|ico|webp|avif|bmp)$/)
  ) {
    return NextResponse.next()
  }

  if (isHealthKitEndpoint(pathname) && req.method === "OPTIONS") {
    return addCorsHeaders(new NextResponse(null, { status: 200 }))
  }

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

  if (isHealthKitEndpoint(pathname)) {
    return addCorsHeaders(NextResponse.next())
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next()
  }

  const tokenCookie =
    req.cookies.get("next-auth.session-token") || req.cookies.get("__Secure-next-auth.session-token")

  if (!tokenCookie) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  const tokenData = parseJWT(tokenCookie.value)
  const userRoles = (tokenData?.roles as string[]) || []

  const isCoach = userRoles.includes("COACH") || userRoles.includes("ADMIN")
  const isClient = userRoles.includes("CLIENT")

  if (pathname.startsWith("/api/entries") && !isClient) {
    return NextResponse.redirect(new URL("/login", req.url))
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

  if (pathname.startsWith("/api/admin") && !userRoles.includes("ADMIN")) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}