import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { passwordSchema } from "@/lib/validations"
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/lib/security/rate-limit"
import bcrypt from "bcryptjs"

// bcrypt cost factor - 12 rounds for strong security
const BCRYPT_ROUNDS = 12

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Rate limiting - 3 password changes per hour
    const rateLimitKey = `password-change:${session.user.id}`
    const rateLimitResult = checkRateLimit(rateLimitKey, RATE_LIMITS.passwordChange)

    if (!rateLimitResult.success) {
      const response = NextResponse.json(
        { error: "Too many password change attempts. Please try again later." },
        { status: 429 }
      )
      const headers = getRateLimitHeaders(rateLimitResult)
      Object.entries(headers).forEach(([key, value]) => {
        response.headers.set(key, value)
      })
      return response
    }

    const body = await req.json()
    const { currentPassword, newPassword } = body

    // Validation
    if (!currentPassword || typeof currentPassword !== "string") {
      return NextResponse.json(
        { error: "Current password is required" },
        { status: 400 }
      )
    }

    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 }
      )
    }

    // Validate new password with strong password policy
    const passwordValidation = passwordSchema.safeParse(newPassword)
    if (!passwordValidation.success) {
      return NextResponse.json(
        { error: passwordValidation.error.issues[0].message },
        { status: 400 }
      )
    }

    // Fetch user with password hash
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        passwordHash: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Check if user has a password (OAuth-only users don't)
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "You signed up with OAuth and don't have a password. Please use your OAuth provider to sign in." },
        { status: 400 }
      )
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 401 }
      )
    }

    // Hash the new password with increased cost factor
    const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)

    // Update the user's password and set passwordChangedAt for session invalidation
    await db.user.update({
      where: { id: session.user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    })

    return NextResponse.json({
      message: "Password changed successfully",
    })
  } catch (error) {
    console.error("Error changing password:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
