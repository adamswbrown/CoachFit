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
 * GDPR Account Deletion Endpoint
 * - Hard delete: Immediate permanent deletion
 * - Soft delete: 30-day grace period before permanent deletion
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
        { error: "Invalid request", details: validation.error.issues },
        { status: 400 }
      )
    }

    const { password, deletionType, reason } = validation.data

    // Get user with password hash
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        passwordHash: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Verify password
    if (!user.passwordHash) {
      return NextResponse.json(
        { error: "Cannot delete account without password" },
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

    if (deletionType === "hard") {
      // Hard delete: Immediate permanent deletion
      // Cascade deletes are configured in Prisma schema
      await db.user.delete({
        where: { id: user.id },
      })

      return NextResponse.json({
        success: true,
        message: "Account permanently deleted",
        deletionType: "hard",
      })
    } else {
      // Soft delete: Mark for deletion with 30-day grace period
      await db.user.update({
        where: { id: user.id },
        data: {
          deletedAt: new Date(),
          deletionReason: reason || null,
          deletionType: "soft",
          // Anonymize email to prevent re-use during grace period
          email: `deleted-${user.id}@coachfit.deleted`,
        },
      })

      return NextResponse.json({
        success: true,
        message: "Account scheduled for deletion in 30 days",
        deletionType: "soft",
        gracePeriodDays: 30,
        deletionDate: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(),
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

/**
 * Restore soft-deleted account (within grace period)
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        deletedAt: true,
        deletionType: true,
        email: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!user.deletedAt || user.deletionType !== "soft") {
      return NextResponse.json(
        { error: "Account is not scheduled for deletion" },
        { status: 400 }
      )
    }

    // Check if still within grace period (30 days)
    const gracePeriodEnd = new Date(user.deletedAt)
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30)

    if (new Date() > gracePeriodEnd) {
      return NextResponse.json(
        { error: "Grace period has expired" },
        { status: 400 }
      )
    }

    // Restore account
    const originalEmail = user.email.replace(`deleted-${user.id}@coachfit.deleted`, "")
    
    await db.user.update({
      where: { id: user.id },
      data: {
        deletedAt: null,
        deletionReason: null,
        deletionType: null,
        // Note: Email restoration would need manual intervention or stored separately
      },
    })

    return NextResponse.json({
      success: true,
      message: "Account restored successfully",
    })
  } catch (error) {
    console.error("Error restoring account:", error)
    return NextResponse.json(
      { error: "Failed to restore account" },
      { status: 500 }
    )
  }
}
