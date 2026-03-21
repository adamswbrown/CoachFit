import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"
import { z } from "zod"

const updateMembershipSchema = z.object({
  type: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "FOUNDER"]).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "CANCELLED", "EXPIRED"]).optional(),
  startDate: z.string().transform((s) => new Date(s)).optional(),
  endDate: z.string().nullable().optional().transform((s) => (s ? new Date(s) : s === null ? null : undefined)),
  price: z.number().min(0).optional(),
  notes: z.string().nullable().optional(),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!isAdmin(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { membershipId } = await params
    const membership = await db.membership.findUnique({
      where: { id: membershipId },
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    if (!membership) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ membership })
  } catch (error) {
    console.error("Error fetching membership:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!isAdmin(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { membershipId } = await params
    const body = await req.json()
    const validated = updateMembershipSchema.parse(body)

    const existing = await db.membership.findUnique({ where: { id: membershipId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const data: any = {}
    if (validated.type !== undefined) data.type = validated.type
    if (validated.status !== undefined) data.status = validated.status
    if (validated.startDate !== undefined) data.startDate = validated.startDate
    if (validated.endDate !== undefined) data.endDate = validated.endDate
    if (validated.price !== undefined) data.price = validated.price
    if (validated.notes !== undefined) data.notes = validated.notes

    const updated = await db.membership.update({
      where: { id: membershipId },
      data,
      include: { user: { select: { id: true, name: true, email: true } } },
    })

    return NextResponse.json({ membership: updated })
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error updating membership:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ membershipId: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!isAdmin(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const { membershipId } = await params
    const existing = await db.membership.findUnique({ where: { id: membershipId } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await db.membership.delete({ where: { id: membershipId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting membership:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
