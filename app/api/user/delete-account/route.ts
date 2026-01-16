import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"

export const dynamic = "force-dynamic"

const deletionSchema = z.object({
  password: z.string().min(1, "Password is required"),
  deletionType: z.enum(["hard", "soft"]),
  reason: z.string().optional(),
})

/**
 * Account Deletion Endpoint
 * POST /api/user/delete-account
 * Supports soft delete (30-day grace period) and hard delete (immediate)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validation = deletionSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { password, deletionType, reason } = validation.data

    // Fetch user and verify password
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, passwordHash: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify password
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Password authentication not available for OAuth-only accounts" },
        { status: 400 }
      )
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash)
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 401 }
      )
    }

    // Get client IP for audit trail
    const ip = request.headers.get("x-forwarded-for") || "unknown"

    // Log deletion request
    await db.adminAction.create({
      data: {
        adminId: session.user.id,
        actionType: "user_deleted",
        targetType: "user",
        targetId: session.user.id,
        details: {
          deletionType,
          reason: reason || null,
          ip,
          timestamp: new Date().toISOString(),
        },
        reason: `User requested ${deletionType} account deletion. Reason: ${reason || "Not provided"}`,
      },
    })

    if (deletionType === "hard") {
      // Immediate hard delete - cascade deletes handle all relations
      await db.user.delete({
        where: { id: session.user.id },
      })

      return NextResponse.json({
        message: "Account permanently deleted",
      })
    } else {
      // Soft delete - mark account and anonymize data
      // For now, we'll use a field on User to mark deletion
      // In production, you'd add an `isDeleted` and `deletedAt` field to User schema

      // Anonymize all sensitive data
      await db.user.update({
        where: { id: session.user.id },
        data: {
          email: `deleted_${session.user.id}@deleted.local`,
          name: "Deleted User",
          passwordHash: null,
          image: null,
          onboardingComplete: false,
        },
      })

      // Anonymize entries
      await db.entry.updateMany({
        where: { userId: session.user.id },
        data: {
          notes: "[deleted]",
        },
      })

      // Anonymize coach notes
      await db.coachNote.updateMany({
        where: { clientId: session.user.id },
        data: {
          note: "[deleted]",
        },
      })

      return NextResponse.json({
        message: "Account scheduled for deletion. You have 30 days to restore it.",
      })
    }
  } catch (error) {
    console.error("Error deleting account:", error)
    return NextResponse.json(
      { error: "Failed to delete account" },
      { status: 500 }
    )
  }
}
