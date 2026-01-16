import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createCohortSchema } from "@/lib/validations"
import { Role } from "@/lib/types"
import { isAdminOrCoach } from "@/lib/permissions"
import { z } from "zod"

export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Allow COACH or ADMIN
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Admins can see all cohorts, coaches see only their own
    const whereClause = session.user.roles.includes(Role.ADMIN)
      ? {}
      : { coachId: session.user.id }

    const cohorts = await db.cohort.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            memberships: true,
            invites: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const cohortsWithCounts = cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      createdAt: cohort.createdAt,
      activeClients: cohort._count.memberships,
      pendingInvites: cohort._count.invites,
    }))

    return NextResponse.json(cohortsWithCounts, { status: 200 })
  } catch (error) {
    console.error("Error fetching cohorts:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Allow COACH or ADMIN
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = createCohortSchema.parse(body)

    // Determine the coach who will own this cohort
    // If admin specifies ownerCoachId, use that; otherwise use current user
    const coachId = validated.ownerCoachId || session.user.id

    // If admin specified a different coach, verify the coach exists
    if (validated.ownerCoachId && validated.ownerCoachId !== session.user.id) {
      const ownerCoach = await db.user.findUnique({
        where: { id: validated.ownerCoachId },
        select: { id: true, roles: true },
      })
      if (!ownerCoach || !ownerCoach.roles.includes(Role.COACH)) {
        return NextResponse.json(
          { error: "Specified coach not found or does not have COACH role" },
          { status: 400 }
        )
      }
    }

    // Create cohort with check-in config and co-coaches in a transaction
    // Mandatory prompts (weightLbs, steps, calories) are always included
    const cohort = await db.$transaction(async (tx: any) => {
      // Create the cohort
      const newCohort = await tx.cohort.create({
        data: {
          name: validated.name,
          coachId: coachId,
        },
      })

      // Always create check-in config with mandatory prompts
      const mandatoryPrompts = ["weightLbs", "steps", "calories"]
      const additionalPrompts = validated.checkInConfig?.enabledPrompts?.filter(
        (p) => !mandatoryPrompts.includes(p)
      ) || []
      const allEnabledPrompts = [...mandatoryPrompts, ...additionalPrompts]

      await tx.cohortCheckInConfig.create({
        data: {
          cohortId: newCohort.id,
          enabledPrompts: allEnabledPrompts,
          customPrompt1: validated.checkInConfig?.customPrompt1 || null,
          customPrompt1Type: validated.checkInConfig?.customPrompt1Type || null,
        },
      })

      // Add co-coaches if provided
      if (validated.coCoaches && validated.coCoaches.length > 0) {
        for (const coachEmail of validated.coCoaches) {
          const coCoach = await tx.user.findUnique({
            where: { email: coachEmail },
            select: { id: true, roles: true },
          })

          if (!coCoach) {
            throw new Error(`Coach with email ${coachEmail} not found`)
          }

          if (!coCoach.roles.includes(Role.COACH)) {
            throw new Error(`User ${coachEmail} does not have COACH role`)
          }

          // Only add if not already the owner
          if (coCoach.id !== coachId) {
            await tx.coachCohortMembership.create({
              data: {
                cohortId: newCohort.id,
                coachId: coCoach.id,
              },
            })
          }
        }
      }

      return newCohort
    })

    return NextResponse.json(cohort, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    if (error.message && error.message.includes("does not have COACH role")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    if (error.message && error.message.includes("not found")) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    console.error("Error creating cohort:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
