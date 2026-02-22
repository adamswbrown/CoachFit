import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"

type NotificationRow = {
  id: string
  createdAt: Date
  actionType: string
  details: Record<string, any> | null
  admin: {
    id: string
    name: string | null
    email: string
  }
}

function buildFallbackMessage(row: NotificationRow): string {
  const details = row.details || {}
  const kind = String(details.kind || "")
  const className = String(details.className || details.productName || "Class")

  if (kind === "booked") return `Booked: ${className}`
  if (kind === "waitlisted") return `Waitlisted: ${className}`
  if (kind === "waitlist_promoted") return `Promoted from waitlist: ${className}`
  if (kind === "cancelled") return `Cancelled: ${className}`
  if (kind === "credit_approved") return `Credit approved: ${className}`
  if (kind === "credit_rejected") return `Credit rejected: ${className}`

  return row.actionType.replace(/_/g, " ")
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isClient(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const limitRaw = req.nextUrl.searchParams.get("limit")
    const limit = Math.min(100, Math.max(1, Number(limitRaw || 30)))

    const rows = await db.adminAction.findMany({
      where: {
        targetType: "class_notification",
        targetId: session.user.id,
      },
      select: {
        id: true,
        createdAt: true,
        actionType: true,
        details: true,
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    })

    const notifications = rows.map((row) => {
      const details = (row.details || {}) as Record<string, any>
      return {
        id: row.id,
        createdAt: row.createdAt,
        kind: details.kind || null,
        className: details.className || null,
        startsAt: details.startsAt || null,
        productName: details.productName || null,
        creditsApplied:
          typeof details.creditsApplied === "number" ? details.creditsApplied : null,
        message: buildFallbackMessage(row as NotificationRow),
        actor: {
          id: row.admin.id,
          name: row.admin.name,
          email: row.admin.email,
        },
      }
    })

    return NextResponse.json({ notifications }, { status: 200 })
  } catch (error) {
    console.error("Error loading class notifications:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
