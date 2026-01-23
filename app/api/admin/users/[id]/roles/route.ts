import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { logAuditAction } from "@/lib/audit-log"
import { z } from "zod"

const updateRolesSchema = z.object({
  action: z.enum(["add", "remove"]),
  role: z.enum(["COACH", "ADMIN"]),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id: userId } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { action, role } = updateRolesSchema.parse(body)

    // Get current user
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, roles: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Prevent removing your own ADMIN role
    if (action === "remove" && role === "ADMIN" && userId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot remove your own admin role" },
        { status: 400 }
      )
    }

    // Cast Prisma enum array to local Role enum for type-safe checks
    const currentRoles = user.roles as Role[]
    let newRoles: Role[]

    if (action === "add") {
      // Add role if not already present
      if (currentRoles.includes(role as Role)) {
        return NextResponse.json(
          { error: `User already has ${role} role` },
          { status: 400 }
        )
      }

      // Prevent adding ADMIN role to non-coaches
      // Business rule: Only coaches (staff) can become admins, not clients
      if (role === "ADMIN" && !currentRoles.includes(Role.COACH)) {
        return NextResponse.json(
          { error: "Only coaches can be made admin. This user is not a coach." },
          { status: 400 }
        )
      }

      newRoles = [...currentRoles, role as Role]
    } else {
      // Remove role
      if (!currentRoles.includes(role as Role)) {
        return NextResponse.json(
          { error: `User does not have ${role} role` },
          { status: 400 }
        )
      }

      if (role === "COACH" && currentRoles.includes(Role.ADMIN)) {
        return NextResponse.json(
          { error: "Cannot remove COACH role from an admin. Remove ADMIN role first." },
          { status: 400 }
        )
      }

      newRoles = currentRoles.filter((r: string) => r !== role) as Role[]

      // Ensure user always has at least CLIENT role
      if (newRoles.length === 0) {
        newRoles = [Role.CLIENT]
      }
    }

    // Update user roles
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { roles: newRoles },
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        isTestUser: true,
        createdAt: true,
        passwordHash: true,
        Account: {
          select: {
            provider: true,
          },
        },
        CohortMembership: {
          select: {
            Cohort: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        Cohort: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "ADMIN_UPDATE_USER_ROLES",
      targetType: "user",
      targetId: updatedUser.id,
      details: { action, role, roles: updatedUser.roles },
    })

    return NextResponse.json(
      {
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          roles: updatedUser.roles,
          isTestUser: updatedUser.isTestUser,
          createdAt: updatedUser.createdAt,
          hasPassword: !!updatedUser.passwordHash,
          authProviders: updatedUser.Account.map((a: { provider: string }) => a.provider),
          cohortsMemberOf: updatedUser.CohortMembership.map((m: { Cohort: { id: string; name: string } }) => ({
            id: m.Cohort.id,
            name: m.Cohort.name,
          })),
          cohortsCoaching: updatedUser.Cohort.map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
          })),
        },
        message: `${action === "add" ? "Added" : "Removed"} ${role} role`,
      },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.issues },
        { status: 400 }
      )
    }
    console.error("Error updating user roles:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
