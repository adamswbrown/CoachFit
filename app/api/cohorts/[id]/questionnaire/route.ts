import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { questionnaireBundleSchema } from "@/lib/validations"
import { isAdminOrCoach, isAdmin } from "@/lib/permissions"

// GET /api/cohorts/[id]/questionnaire - Fetch bundle JSON schema
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: cohortId } = await params

    // Fetch the cohort to verify ownership
    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true, coachId: true },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Check ownership (only owner or admin can access)
    if (cohort.coachId !== session.user.id && !isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch the questionnaire bundle
    const bundle = await db.questionnaireBundle.findUnique({
      where: { cohortId },
    })

    if (!bundle) {
      return NextResponse.json(
        { error: "No questionnaire bundle found for this cohort" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: bundle.id,
      cohortId: bundle.cohortId,
      bundleJson: bundle.bundleJson,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
    })
  } catch (error) {
    console.error("Error fetching questionnaire bundle:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

// POST /api/cohorts/[id]/questionnaire - Create/update bundle from Creator JSON
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id: cohortId } = await params

    // Fetch the cohort to verify ownership
    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true, coachId: true },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Check ownership (only owner or admin can update)
    if (cohort.coachId !== session.user.id && !isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = questionnaireBundleSchema.parse(body)

    // Upsert the questionnaire bundle
    const bundle = await db.questionnaireBundle.upsert({
      where: { cohortId },
      create: {
        cohortId,
        bundleJson: validated.bundleJson,
      },
      update: {
        bundleJson: validated.bundleJson,
      },
    })

    return NextResponse.json({
      id: bundle.id,
      cohortId: bundle.cohortId,
      bundleJson: bundle.bundleJson,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
    })
  } catch (error) {
    console.error("Error saving questionnaire bundle:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
