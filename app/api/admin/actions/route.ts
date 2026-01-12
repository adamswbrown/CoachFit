import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"
import { z } from "zod"

const createActionSchema = z.object({
  actionType: z.string(),
  targetType: z.string(),
  targetId: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
  reason: z.string().optional(),
  insightId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { actionType, targetType, targetId, details, reason, insightId } =
      createActionSchema.parse(body)

    // Create admin action record
    const adminAction = await db.adminAction.create({
      data: {
        adminId: session.user.id,
        actionType,
        targetType,
        targetId: targetId || null,
        details: details || {},
        reason: reason || null,
        insightId: insightId || null,
      },
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        action: adminAction,
        message: "Action logged successfully",
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      )
    }
    console.error("Error logging admin action:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// GET /api/admin/actions - Retrieve admin actions (for audit trail)
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const targetType = searchParams.get("targetType")
    const targetId = searchParams.get("targetId")
    const limit = parseInt(searchParams.get("limit") || "100")

    const where: any = {}
    if (targetType) {
      where.targetType = targetType
    }
    if (targetId) {
      where.targetId = targetId
    }

    const actions = await db.adminAction.findMany({
      where,
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    })

    return NextResponse.json({ actions }, { status: 200 })
  } catch (error) {
    console.error("Error fetching admin actions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
