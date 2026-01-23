import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"
import { logAuditAction } from "@/lib/audit-log"
import { z } from "zod"

const createSchema = z.object({
  label: z.string().min(1, "Label is required").max(80, "Label must be 80 characters or less"),
  description: z.string().max(500, "Description must be 500 characters or less").optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = req.nextUrl.searchParams
    const search = searchParams.get("search")?.trim()

    const types = await db.customCohortType.findMany({
      where: search
        ? {
            label: {
              contains: search,
              mode: "insensitive",
            },
          }
        : undefined,
      include: {
        _count: {
          select: { Cohort: true },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ types }, { status: 200 })
  } catch (error) {
    console.error("Error fetching custom cohort types:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = createSchema.parse(body)

    const existing = await db.customCohortType.findUnique({
      where: { label: validated.label.trim() },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json({ error: "A custom cohort type with that label already exists" }, { status: 409 })
    }

    const created = await db.customCohortType.create({
      data: {
        label: validated.label.trim(),
        description: validated.description?.trim() || null,
        createdBy: session.user.id,
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "custom_cohort_type_created",
      targetType: "custom_cohort_type",
      targetId: created.id,
      details: {
        label: created.label,
        description: created.description,
      },
    })

    return NextResponse.json({ type: created }, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.flatten() },
        { status: 400 }
      )
    }
    console.error("Error creating custom cohort type:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
