import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { logAuditAction } from "@/lib/audit-log"
import bcrypt from "bcryptjs"
import { passwordSchema } from "@/lib/validations"

// bcrypt cost factor — 12 rounds for strong security
const BCRYPT_ROUNDS = 12

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: clientId } = await params
    const body = await req.json()
    const { newPassword } = body

    // Validation
    if (!newPassword || typeof newPassword !== "string") {
      return NextResponse.json(
        { error: "New password is required" },
        { status: 400 }
      )
    }

    const passwordValidation = passwordSchema.safeParse(newPassword)
    if (!passwordValidation.success) {
      return NextResponse.json(
        { error: passwordValidation.error.issues[0]?.message || "Password must be at least 12 characters and include uppercase, lowercase, number, and special character" },
        { status: 400 }
      )
    }

    // Verify the client exists
    const client = await db.user.findUnique({
      where: { id: clientId },
      select: {
        id: true,
      },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Check if client is in any of the coach's cohorts (unless admin)
    if (!session.user.roles.includes(Role.ADMIN)) {
      const cohortMembership = await db.cohortMembership.findFirst({
        where: {
          userId: clientId,
          Cohort: {
            coachId: session.user.id,
          },
        },
      })

      if (!cohortMembership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS)

    // Update the client's password
    await db.user.update({
      where: { id: clientId },
      data: { passwordHash, mustChangePassword: true },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CLIENT_RESET_PASSWORD",
      targetType: "client",
      targetId: clientId,
      details: {
        mustChangePassword: true,
      },
    })

    return NextResponse.json({
      message: "Password reset successfully",
    })
  } catch (error) {
    console.error("Error resetting password:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
