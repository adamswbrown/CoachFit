/**
 * Clerk handles auth routes automatically via its middleware.
 * This catch-all route is kept to prevent 404s on legacy /api/auth/* requests.
 */
import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({ error: "Auth is handled by Clerk" }, { status: 404 })
}

export async function POST() {
  return NextResponse.json({ error: "Auth is handled by Clerk" }, { status: 404 })
}
