import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { addClientToCohortSchema } from "@/lib/validations"
import { Role } from "@/lib/types"
import { sendSystemEmail } from "@/lib/email"
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates"
import { isAdmin } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"

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

    const isAdminUser = isAdmin(session.user)

    // Must be COACH or ADMIN
    if (!session.user.roles.includes(Role.COACH) && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const cohort = await db.cohort.findUnique({
      where: { id },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Authorization check for coaches (admins can view any cohort)
    if (!isAdminUser && cohort.coachId !== session.user.id) {
      // Check if coach is a co-coach on this cohort
      const isCoCoach = await db.coachCohortMembership.findUnique({
        where: {
          coachId_cohortId: {
            coachId: session.user.id,
            cohortId: id
          }
        }
      })
      
      if (!isCoCoach) {
        // Check if coach has access to any members in this cohort
        const memberships = await db.cohortMembership.findMany({
          where: { cohortId: id },
        })
        
        const memberIds = memberships.map(m => m.userId)
        
        const hasAccessToMembers = await db.cohortMembership.findFirst({
          where: {
            userId: { in: memberIds },
            Cohort: {
              OR: [
                { coachId: session.user.id },
                {
                  coachMemberships: {
                    some: { coachId: session.user.id }
                  }
                }
              ]
            }
          }
        })
        
        if (!hasAccessToMembers) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 })
        }
      }
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
            roles: true, // Include roles to filter clients
          },
        },
      },
    })

    // Filter to only include users with CLIENT role
    const clientMemberships = memberships.filter(m => 
      m.user.roles.includes(Role.CLIENT)
    )

    const invites = await db.cohortInvite.findMany({
      where: {
        cohortId: id,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      },
    })

    // Return only client members (exclude coaches)
    const members = clientMemberships.map((membership) => ({
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email
    }))

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

    const isAdminUser = isAdmin(session.user)

    // Must be COACH or ADMIN
    if (!session.user.roles.includes(Role.COACH) && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const cohort = await db.cohort.findUnique({
      where: { id },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Authorization: allow admins, owners, or co-coaches to add members
    const isOwner = cohort.coachId === session.user.id
    const isCoCoach = !isOwner && !isAdminUser ? await db.coachCohortMembership.findUnique({
      where: {
        coachId_cohortId: {
          coachId: session.user.id,
          cohortId: id
        }
      }
    }) : null

    if (!isAdminUser && !isOwner && !isCoCoach) {
      return NextResponse.json({ error: "Forbidden - Only cohort owner or co-coaches can add members" }, { status: 403 })
    }

    const body = await req.json()
    const validated = addClientToCohortSchema.parse(body)

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: validated.email },
    })

    if (user) {
      const existingMembershipForUser = await db.cohortMembership.findFirst({
        where: { userId: user.id },
        select: { cohortId: true },
      })

      if (existingMembershipForUser && existingMembershipForUser.cohortId !== id) {
        return NextResponse.json(
          { error: "Client is already assigned to another cohort" },
          { status: 409 }
        )
      }

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

      await logAuditAction({
        actor: session.user,
        actionType: "COHORT_ADD_CLIENT",
        targetType: "client",
        targetId: user.id,
        details: {
          cohortId: id,
          email: user.email,
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
      const invite = await db.cohortInvite.create({
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
          
          const loginUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/signup`
          const coachName = coach?.name || coach?.email || "Your coach"
          const cohortName = cohort.name

          // Check if invite email is for a test user (emails ending in .test.local)
          const isTestUserEmail = validated.email.endsWith(".test.local")

          await sendSystemEmail({
            templateKey: EMAIL_TEMPLATE_KEYS.COHORT_INVITE,
            to: validated.email,
            variables: {
              coachName,
              cohortName,
              userEmail: validated.email,
              loginUrl,
            },
            fallbackSubject: "You've been invited to CoachFit",
            fallbackHtml: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1f2937;">You've been invited to CoachFit</h2>
                <p>Hi there,</p>
                <p><strong>${coachName}</strong> has invited you to join the <strong>${cohortName}</strong> cohort.</p>
                <p>Sign up to get started and begin tracking your progress.</p>
                <p style="margin-top: 24px;">
                  <a href="${loginUrl}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Sign up to get started
                  </a>
                </p>
                <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
                  If you have any questions, please contact your coach.
                </p>
              </div>
            `,
            fallbackText: `You've been invited to CoachFit\n\n${coachName} has invited you to join the ${cohortName} cohort.\n\nSign up to get started: ${loginUrl}\n\nIf you have any questions, please contact your coach.`,
            isTestUser: isTestUserEmail,
          })
        }
      } catch (emailError) {
        // Log error but don't block the API response
        console.error("Error sending invite email:", emailError)
      }

      await logAuditAction({
        actor: session.user,
        actionType: "COHORT_INVITE_CLIENT",
        targetType: "cohort_invite",
        targetId: invite.id,
        details: {
          cohortId: id,
          email: invite.email,
        },
      })
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
        id: true,
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
