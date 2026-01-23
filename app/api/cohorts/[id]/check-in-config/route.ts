import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@/lib/types"
import { logAuditAction } from "@/lib/audit-log"
import { z } from "zod"

const updateCheckInConfigSchema = z.object({
  enabledPrompts: z.array(z.string()).optional(),
  customPrompt1: z.string().max(100, "Custom prompt label must be 100 characters or less").optional().nullable(),
  customPrompt1Type: z.enum(["scale", "text", "number"]).optional().nullable(),
})

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

    // Must be COACH
    if (!session.user.roles.includes(Role.COACH)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify cohort exists and coach owns it
    const cohort = await db.cohort.findUnique({
      where: { id },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    if (cohort.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch or create default config
    let config = await db.cohortCheckInConfig.findUnique({
      where: { cohortId: id },
    })

    // If no config exists, return default with mandatory prompts
    if (!config) {
      return NextResponse.json({
        enabledPrompts: ["weightLbs", "steps", "calories", "perceivedStress"], // Default mandatory prompts
        customPrompt1: null,
        customPrompt1Type: null,
      }, { status: 200 })
    }

    const mandatoryPrompts = ["weightLbs", "steps", "calories", "perceivedStress"]
    const enabledPrompts = Array.from(new Set([...mandatoryPrompts, ...config.enabledPrompts]))
    return NextResponse.json(
      {
        ...config,
        enabledPrompts,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching check-in config:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Must be COACH
    if (!session.user.roles.includes(Role.COACH)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify cohort exists and coach owns it
    const cohort = await db.cohort.findUnique({
      where: { id },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    if (cohort.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = updateCheckInConfigSchema.parse(body)

    // Mandatory prompts must always be included
    const mandatoryPrompts = ["weightLbs", "steps", "calories", "perceivedStress"]
    const additionalPrompts = validated.enabledPrompts?.filter(
      (p) => !mandatoryPrompts.includes(p)
    ) || []
    const allEnabledPrompts = [...mandatoryPrompts, ...additionalPrompts]

    // Upsert config (update if exists, create if not)
    const config = await db.cohortCheckInConfig.upsert({
      where: { cohortId: id },
      update: {
        enabledPrompts: allEnabledPrompts,
        customPrompt1: validated.customPrompt1 ?? null,
        customPrompt1Type: validated.customPrompt1Type ?? null,
      },
      create: {
        cohortId: id,
        enabledPrompts: allEnabledPrompts,
        customPrompt1: validated.customPrompt1 ?? null,
        customPrompt1Type: validated.customPrompt1Type ?? null,
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "COHORT_UPDATE_CHECKIN_CONFIG",
      targetType: "cohort_checkin_config",
      targetId: config.id,
      details: {
        cohortId: id,
        enabledPrompts: allEnabledPrompts,
      },
    })

    return NextResponse.json(config, { status: 200 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    console.error("Error updating check-in config:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
