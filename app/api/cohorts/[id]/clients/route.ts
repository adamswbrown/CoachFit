import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { addClientToCohortSchema } from "@/lib/validations"
import { Role } from "@/lib/types"
import { sendTransactionalEmail } from "@/lib/email"

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

    // Defensive check: verify role is COACH
    if (!session.user.roles.includes(Role.COACH)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const cohort = await db.cohort.findUnique({
      where: { id },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Ownership check: verify coach owns this cohort
    if (cohort.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const memberships = await db.cohortMembership.findMany({
      where: {
        cohortId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    const invites = await db.cohortInvite.findMany({
      where: {
        cohortId: id,
      },
      select: {
        email: true,
        createdAt: true,
      },
    })

    const members = memberships.map((membership: { user: { id: string; name: string | null; email: string } }) => membership.user)

    return NextResponse.json(
      { members, invites },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching cohort clients:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Defensive check: verify role is COACH
    if (!session.user.roles.includes(Role.COACH)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const cohort = await db.cohort.findUnique({
      where: { id },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Ownership check: verify coach owns this cohort
    if (cohort.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const validated = addClientToCohortSchema.parse(body)

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: validated.email },
    })

    if (user) {
      // User exists - check if already in cohort
      const existingMembership = await db.cohortMembership.findUnique({
        where: {
          userId_cohortId: {
            userId: user.id,
            cohortId: id,
          },
        },
      })

      if (existingMembership) {
        return NextResponse.json(
          { error: "Client already in cohort" },
          { status: 409 }
        )
      }

      // Create membership immediately
      await db.cohortMembership.create({
        data: {
          userId: user.id,
          cohortId: id,
        },
      })

      // Clean up any pending invite for this email
      await db.cohortInvite.deleteMany({
        where: {
          email: validated.email,
          cohortId: id,
        },
      })
    } else {
      // User doesn't exist - check if invite already exists
      const existingInvite = await db.cohortInvite.findUnique({
        where: {
          email_cohortId: {
            email: validated.email,
            cohortId: id,
          },
        },
      })

      if (existingInvite) {
        return NextResponse.json(
          { error: "Invite already sent to this email" },
          { status: 409 }
        )
      }

      // Create invite
      await db.cohortInvite.create({
        data: {
          email: validated.email,
          cohortId: id,
        },
      })

      // Send invite email (non-blocking)
      try {
        const cohort = await db.cohort.findUnique({
          where: { id },
        })

        if (cohort) {
          const coach = await db.user.findUnique({
            where: { id: cohort.coachId },
            select: { name: true, email: true },
          })
          
          const loginUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`
          const coachName = coach?.name || coach?.email || "Your coach"
          const cohortName = cohort.name

          // Check if invite email is for a test user (emails ending in .test.local)
          const isTestUserEmail = validated.email.endsWith(".test.local")

          await sendTransactionalEmail({
            to: validated.email,
            subject: "You've been invited to CoachSync",
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1f2937;">You've been invited to CoachSync</h2>
                <p>Hi there,</p>
                <p><strong>${coachName}</strong> has invited you to join the <strong>${cohortName}</strong> cohort.</p>
                <p>Sign in to get started and begin tracking your progress.</p>
                <p style="margin-top: 24px;">
                  <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Sign in to get started
                  </a>
                </p>
                <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
                  If you have any questions, please contact your coach.
                </p>
              </div>
            `,
            text: `You've been invited to CoachSync\n\n${coachName} has invited you to join the ${cohortName} cohort.\n\nSign in to get started: ${loginUrl}\n\nIf you have any questions, please contact your coach.`,
            isTestUser: isTestUserEmail,
          })
        }
      } catch (emailError) {
        // Log error but don't block the API response
        console.error("Error sending invite email:", emailError)
      }
    }

    // Return updated list of members and invites
    const memberships = await db.cohortMembership.findMany({
      where: {
        cohortId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    const invites = await db.cohortInvite.findMany({
      where: {
        cohortId: id,
      },
      select: {
        email: true,
        createdAt: true,
      },
    })

    const members = memberships.map((membership: { user: { id: string; name: string | null; email: string } }) => membership.user)

    return NextResponse.json(
      { members, invites },
      { status: 201 }
    )
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Client already in cohort" },
        { status: 409 }
      )
    }

    console.error("Error adding client to cohort:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
