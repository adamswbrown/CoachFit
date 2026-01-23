import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { isAdmin } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"
import { z } from "zod"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isCoach = session.user.roles.includes(Role.COACH)
    const isAdminUser = isAdmin(session.user)

    // Must be COACH or ADMIN
    if (!isCoach && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify client exists
    const client = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        invitedByCoachId: true,
        onboardingComplete: true,
        checkInFrequencyDays: true,
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        CohortMembership: {
          include: {
            Cohort: {
              select: {
                id: true,
                name: true,
                coachId: true,
                User: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Authorization: If COACH, verify client is in at least one cohort owned by coach
    if (isCoach && !isAdminUser) {
      const membership = await db.cohortMembership.findFirst({
        where: {
          userId: id,
          Cohort: {
            coachId: session.user.id,
          },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: "Forbidden: Client not in your cohorts" },
          { status: 403 }
        )
      }
    }

    return NextResponse.json(client, { status: 200 })
  } catch (error) {
    console.error("Error fetching client:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

const updateClientSchema = z.object({
  checkInFrequencyDays: z.number().int().min(1).max(365).nullable(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isCoach = session.user.roles.includes(Role.COACH)
    const isAdminUser = isAdmin(session.user)

    if (!isCoach && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = updateClientSchema.parse(body)

    if (isCoach && !isAdminUser) {
      const membership = await db.cohortMembership.findFirst({
        where: {
          userId: id,
          Cohort: {
            coachId: session.user.id,
          },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: "Forbidden: Client not in your cohorts" },
          { status: 403 }
        )
      }
    }

    const updated = await db.user.update({
      where: { id },
      data: {
        checkInFrequencyDays: validated.checkInFrequencyDays,
      },
      select: {
        id: true,
        checkInFrequencyDays: true,
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "CLIENT_UPDATE",
      targetType: "client",
      targetId: updated.id,
      details: {
        checkInFrequencyDays: updated.checkInFrequencyDays,
      },
    })

    return NextResponse.json(updated, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.flatten() },
        { status: 400 }
      )
    }
    console.error("Error updating client:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
