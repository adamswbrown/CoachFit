import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { auth } from "@/lib/auth"

export async function GET() {
  const timestamp = Date.now()

  try {
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()

    const sessionToken = cookieStore.get('__Secure-authjs.session-token') || cookieStore.get('authjs.session-token')

    const session = await auth()

    return NextResponse.json({
      timestamp,
      message: "Debug endpoint reached",
      cookies: {
        count: allCookies.length,
        names: allCookies.map(c => c.name),
        hasSessionToken: !!sessionToken,
      },
      session: {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id || null,
        userEmail: session?.user?.email || null,
        userRoles: session?.user?.roles || null,
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      timestamp,
      error: error?.message || "Unknown error",
      stack: error?.stack,
    }, { status: 500 })
  }
}
