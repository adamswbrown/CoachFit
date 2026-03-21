import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { db } from "@/lib/db"
import { z } from "zod"

const createMembershipSchema = z.object({
  userId: z.string(),
  type: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "FOUNDER"]),
  status: z.enum(["ACTIVE", "PAUSED", "CANCELLED", "EXPIRED"]).default("ACTIVE"),
  startDate: z.string().transform((s) => new Date(s)),
  endDate: z.string().optional().transform((s) => (s ? new Date(s) : undefined)),
  price: z.number().min(0),
  notes: z.string().optional(),
})

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!isAdmin(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const memberships = await db.membership.findMany({
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ memberships })
  } catch (error) {
    console.error("Error fetching memberships:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (!isAdmin(session.user)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await req.json()
    const validated = createMembershipSchema.parse(body)

    // Check user exists
    const user = await db.user.findUnique({ where: { id: validated.userId } })
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

    // Check no existing membership
    const existing = await db.membership.findUnique({ where: { userId: validated.userId } })
    if (existing) return NextResponse.json({ error: "User already has a membership" }, { status: 409 })

    const membership = await db.membership.create({
      data: {
        userId: validated.userId,
        type: validated.type,
        status: validated.status,
        startDate: validated.startDate,
        endDate: validated.endDate,
        price: validated.price,
        notes: validated.notes,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    })

    return NextResponse.json({ membership }, { status: 201 })
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: "Validation error", details: error.errors }, { status: 400 })
    }
    console.error("Error creating membership:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
