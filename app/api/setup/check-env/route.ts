import { NextResponse } from "next/server"
import { db } from "@/lib/db"

/**
 * GET /api/setup/check-env
 * Check environment variables and database connectivity.
 * Only accessible when setup is not complete.
 */
export async function GET() {
  try {
    // Check if setup is already complete
    const settings = await db.systemSettings.findFirst({
      select: { setupComplete: true },
    })
    if (settings?.setupComplete) {
      return NextResponse.json({ error: "Setup already complete" }, { status: 403 })
    }
  } catch {
    // DB might not be connected yet — that's what we're checking
  }

  const checks: {
    name: string
    status: "pass" | "fail" | "warn"
    message: string
  }[] = []

  // Check DATABASE_URL
  if (process.env.DATABASE_URL) {
    checks.push({
      name: "DATABASE_URL",
      status: "pass",
      message: "Database URL is configured",
    })
  } else {
    checks.push({
      name: "DATABASE_URL",
      status: "fail",
      message: "DATABASE_URL environment variable is not set. Configure it in your hosting provider.",
    })
  }

  // Check NEXTAUTH_SECRET
  if (process.env.NEXTAUTH_SECRET) {
    checks.push({
      name: "NEXTAUTH_SECRET",
      status: "pass",
      message: "Auth secret is configured",
    })
  } else {
    checks.push({
      name: "NEXTAUTH_SECRET",
      status: "fail",
      message: "NEXTAUTH_SECRET is not set. Generate one with: openssl rand -base64 32",
    })
  }

  // Check NEXTAUTH_URL
  if (process.env.NEXTAUTH_URL) {
    checks.push({
      name: "NEXTAUTH_URL",
      status: "pass",
      message: `App URL: ${process.env.NEXTAUTH_URL}`,
    })
  } else {
    checks.push({
      name: "NEXTAUTH_URL",
      status: "warn",
      message: "NEXTAUTH_URL is not set. This may cause auth issues in production.",
    })
  }

  // Check Google OAuth (optional)
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    checks.push({
      name: "GOOGLE_OAUTH",
      status: "pass",
      message: "Google OAuth is configured",
    })
  } else {
    checks.push({
      name: "GOOGLE_OAUTH",
      status: "warn",
      message: "Google OAuth is not configured. Users can still sign in with email/password.",
    })
  }

  // Check Resend (optional)
  if (process.env.RESEND_API_KEY) {
    checks.push({
      name: "RESEND_API_KEY",
      status: "pass",
      message: "Email service (Resend) is configured",
    })
  } else {
    checks.push({
      name: "RESEND_API_KEY",
      status: "warn",
      message: "Email service is not configured. Emails will be disabled until configured.",
    })
  }

  // Check database connectivity
  try {
    await db.$queryRaw`SELECT 1`
    checks.push({
      name: "DATABASE_CONNECTION",
      status: "pass",
      message: "Successfully connected to database",
    })
  } catch (error) {
    checks.push({
      name: "DATABASE_CONNECTION",
      status: "fail",
      message: "Cannot connect to database. Check your DATABASE_URL.",
    })
  }

  const allPassed = checks.every((c) => c.status !== "fail")

  return NextResponse.json({ checks, allPassed })
}
