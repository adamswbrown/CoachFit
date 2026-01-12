import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createCohortSchema } from "@/lib/validations"
import { Role } from "@prisma/client"
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
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    const cohortsWithCount = cohorts.map((cohort) => ({
      id: cohort.id,
      name: cohort.name,
      createdAt: cohort.createdAt,
      clientCount: cohort.memberships.length,
    }))

    return NextResponse.json(cohortsWithCount, { status: 200 })
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

    // For admins, we need to assign a coach. If no coachId provided, use the admin's ID
    // (admins can act as coaches)
    const coachId = validated.coachId || session.user.id

    // Create cohort with check-in config in a transaction
    // Mandatory prompts (weightLbs, steps, calories) are always included
    const cohort = await db.$transaction(async (tx) => {
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

    console.error("Error creating cohort:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
