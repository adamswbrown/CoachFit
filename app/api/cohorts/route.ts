import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { createCohortSchema } from "@/lib/validations"
import { Role } from "@/lib/types"
import { isAdminOrCoach } from "@/lib/permissions"
import { DEFAULT_TEMPLATES } from "@/lib/default-questionnaire-templates"
import { z } from "zod"
import { logAuditAction } from "@/lib/audit-log"

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

    const searchParams = req.nextUrl.searchParams
    const ownerId = searchParams.get("ownerId")

    // Admins can see all cohorts; optional owner filter. Coaches see owned or co-owned.
    const whereClause = session.user.roles.includes(Role.ADMIN)
      ? ownerId
        ? { coachId: ownerId }
        : {}
      : {
          OR: [
            { coachId: session.user.id },
            { coachMemberships: { some: { coachId: session.user.id } } },
          ],
        }

    const cohorts = await db.cohort.findMany({
      where: {
        AND: [
          whereClause,
          {
            NOT: {
              name: {
                startsWith: "Template:",
              },
            },
          },
        ],
      },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        customCohortType: {
          select: {
            id: true,
            label: true,
            description: true,
          },
        },
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
      cohortStartDate: cohort.cohortStartDate,
      activeClients: cohort._count.memberships,
      pendingInvites: cohort._count.invites,
      coachId: cohort.User.id,
      coachName: cohort.User.name,
      coachEmail: cohort.User.email,
      type: cohort.type,
      customTypeLabel: cohort.customTypeLabel,
      customCohortType: cohort.customCohortType,
      checkInFrequencyDays: cohort.checkInFrequencyDays,
      requiresMigration: !cohort.type,
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

    if (validated.type !== "CUSTOM" && (validated.customCohortTypeId || validated.customTypeLabel)) {
      return NextResponse.json(
        { error: "Custom type is only allowed when cohort type is CUSTOM" },
        { status: 400 }
      )
    }

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
      // Determine duration weeks based on config
      const durationWeeks = validated.durationConfig === "six-week" ? 6 : validated.durationWeeks
      const customCohortType = validated.customCohortTypeId
        ? await tx.customCohortType.findUnique({
            where: { id: validated.customCohortTypeId },
            select: { id: true, label: true },
          })
        : null

      if (validated.customCohortTypeId && !customCohortType) {
        throw new Error("Custom cohort type not found")
      }

      // Create the cohort
      const newCohort = await tx.cohort.create({
        data: {
          name: validated.name,
          coachId: coachId,
          cohortStartDate: new Date(validated.cohortStartDate),
          durationConfig: validated.durationConfig,
          durationWeeks: durationWeeks,
          type: validated.type,
          customCohortTypeId: validated.type === "CUSTOM" ? customCohortType?.id || null : null,
          customTypeLabel:
            validated.type === "CUSTOM"
              ? validated.customTypeLabel?.trim() || customCohortType?.label || null
              : null,
          checkInFrequencyDays: validated.checkInFrequencyDays ?? null,
        },
      })

      // Always create check-in config with mandatory prompts
      const mandatoryPrompts = ["weightLbs", "steps", "calories", "perceivedStress"]
      const defaultOptionalPrompts: string[] = []
      const additionalPrompts = validated.checkInConfig?.enabledPrompts?.filter(
        (p) => !mandatoryPrompts.includes(p)
      ) || []
      const allEnabledPrompts = Array.from(
        new Set([...mandatoryPrompts, ...defaultOptionalPrompts, ...additionalPrompts])
      )

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

      const bundleJson = {
        week1: DEFAULT_TEMPLATES.week1,
        week2: DEFAULT_TEMPLATES.week2,
        week3: DEFAULT_TEMPLATES.week3,
        week4: DEFAULT_TEMPLATES.week4,
        week5: DEFAULT_TEMPLATES.week5,
      }

      await tx.questionnaireBundle.create({
        data: {
          cohortId: newCohort.id,
          bundleJson: bundleJson as any,
        },
      })

      return newCohort
    })

    await logAuditAction({
      actor: session.user,
      actionType: "COHORT_CREATE",
      targetType: "cohort",
      targetId: cohort.id,
      details: { name: cohort.name, coachId: cohort.coachId },
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
