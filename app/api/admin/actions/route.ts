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
    const actionType = searchParams.get("actionType")
    const errorType = searchParams.get("errorType")
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const format = searchParams.get("format")
    const limit = parseInt(searchParams.get("limit") || "100")

    const where: any = {}
    if (targetType) {
      where.targetType = targetType
    }
    if (targetId) {
      where.targetId = targetId
    }
    if (actionType) {
      where.actionType = actionType
    }
    if (errorType) {
      where.OR = [
        {
          details: {
            path: ["errorType"],
            equals: errorType,
          },
        },
        {
          details: {
            path: ["error", "type"],
            equals: errorType,
          },
        },
        {
          details: {
            path: ["error", "name"],
            equals: errorType,
          },
        },
        {
          details: {
            path: ["errorName"],
            equals: errorType,
          },
        },
      ]
    }
    if (startDate || endDate) {
      const createdAt: { gte?: Date; lte?: Date } = {}
      if (startDate && !Number.isNaN(Date.parse(startDate))) {
        createdAt.gte = new Date(`${startDate}T00:00:00.000Z`)
      }
      if (endDate && !Number.isNaN(Date.parse(endDate))) {
        createdAt.lte = new Date(`${endDate}T23:59:59.999Z`)
      }
      where.createdAt = createdAt
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
    if (format === "csv") {
      const getErrorType = (details: unknown): string => {
        if (!details || typeof details !== "object") return ""
        const record = details as Record<string, any>
        if (typeof record.errorType === "string" && record.errorType) {
          return record.errorType
        }
        const nestedError = record.error
        if (nestedError && typeof nestedError === "object") {
          const nestedType = (nestedError as Record<string, any>).type
          if (typeof nestedType === "string" && nestedType) return nestedType
          const nestedName = (nestedError as Record<string, any>).name
          if (typeof nestedName === "string" && nestedName) return nestedName
        }
        if (typeof record.errorName === "string" && record.errorName) {
          return record.errorName
        }
        return ""
      }
      const headers = [
        "Time",
        "Action",
        "Target Type",
        "Target ID",
        "Admin Name",
        "Admin Email",
        "Reason",
        "Error Type",
        "Details",
      ]
      const rows = actions.map((action) => {
        const details = action.details ? JSON.stringify(action.details) : ""
        const errorTypeValue = getErrorType(action.details)
        return [
          action.createdAt.toISOString(),
          action.actionType,
          action.targetType,
          action.targetId ?? "",
          action.admin.name ?? "",
          action.admin.email ?? "",
          action.reason ?? "",
          errorTypeValue ?? "",
          details,
        ]
      })
      const escape = (value: string) => `"${value.replace(/"/g, "\"\"")}"`
      const csv = [headers, ...rows]
        .map((row) => row.map((value) => escape(String(value ?? ""))).join(","))
        .join("\n")

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=\"audit-log.csv\"",
        },
      })
    }

    return NextResponse.json({ actions }, { status: 200 })
  } catch (error) {
    console.error("Error fetching admin actions:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
