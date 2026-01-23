import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach, isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { z } from "zod"
import { logAuditAction } from "@/lib/audit-log"

const assignClientSchema = z.object({
  cohortId: z.string().min(1, "Cohort ID is required"),
})

// POST /api/clients/[id]/assign - Assign a client to a cohort
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id: clientId } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden: Coach or Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { cohortId } = assignClientSchema.parse(body)

    // Verify the cohort exists
    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Admins can assign to any cohort, coaches can only assign to their own
    const isAdminUser = isAdmin(session.user)
    if (!isAdminUser && cohort.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden: Not your cohort" }, { status: 403 })
    }

    // Verify the client exists
    const client = await db.user.findUnique({
      where: { id: clientId },
      select: { id: true, email: true, name: true, invitedByCoachId: true },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // For coaches, client must be linked to them. Admins can assign any client.
    if (!isAdminUser && client.invitedByCoachId !== session.user.id) {
      return NextResponse.json(
        { error: "Forbidden: This client was not invited by you" },
        { status: 403 }
      )
    }

    // Check if already a member
    const existingMembership = await db.cohortMembership.findUnique({
      where: {
        userId_cohortId: {
          userId: clientId,
          cohortId: cohortId,
        },
      },
    })

    if (existingMembership) {
      return NextResponse.json(
        { error: "Client is already a member of this cohort" },
        { status: 409 }
      )
    }

    const existingAnyMembership = await db.cohortMembership.findFirst({
      where: { userId: clientId },
      select: { cohortId: true },
    })

    if (existingAnyMembership) {
      return NextResponse.json(
        { error: "Client is already assigned to another cohort" },
        { status: 409 }
      )
    }

    // Create the membership
    await db.cohortMembership.create({
      data: {
        userId: clientId,
        cohortId: cohortId,
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "COHORT_ASSIGN_CLIENT",
      targetType: "cohort_membership",
      targetId: `${clientId}:${cohortId}`,
      details: { clientId, cohortId },
    })

    return NextResponse.json(
      { message: "Client assigned to cohort successfully" },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request" },
        { status: 400 }
      )
    }
    console.error("Error assigning client to cohort:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
