import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"
import { Role } from "@/lib/types"
import bcrypt from "bcryptjs"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
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

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
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
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // Update the client's password
    await db.user.update({
      where: { id: clientId },
      data: { passwordHash, mustChangePassword: true },
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
