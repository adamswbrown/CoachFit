import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { enrollInChallenge } from "@/lib/challenges"
import { enrollInChallengeSchema } from "@/lib/validations/challenges"
import { logAuditAction } from "@/lib/audit-log"
import { z } from "zod"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ cohortId: string }> }
) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { cohortId } = await params

    // Validate cohortId from route
    const parsed = enrollInChallengeSchema.safeParse({ cohortId })
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.issues },
        { status: 400 }
      )
    }

    await enrollInChallenge(session.user.id, cohortId)

    await logAuditAction({
      actor: session.user,
      actionType: "CHALLENGE_ENROLL",
      targetType: "cohort",
      targetId: cohortId,
      details: { cohortId },
    })

    return NextResponse.json(
      { message: "Enrolled in challenge", cohortId },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.issues },
        { status: 400 }
      )
    }

    if (
      error.message === "Challenge not found" ||
      error.message === "Cohort is not a challenge"
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    if (error.message === "Already enrolled in this challenge") {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    console.error("Error enrolling in challenge:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
