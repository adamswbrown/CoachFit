import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { z } from "zod"
import bcrypt from "bcryptjs"
import { logAuditAction } from "@/lib/audit-log"

const createAdminSchema = z.object({
  email: z.string().email("Invalid email format"),
  name: z.string().min(1, "Name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

// POST /api/admin/admins - Create a new admin user
export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { email, name, password } = createAdminSchema.parse(body)

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10)

    // Create user with ADMIN role only
    const newAdmin = await db.user.create({
      data: {
        email,
        name,
        passwordHash,
        mustChangePassword: false,
        roles: [Role.ADMIN],
      },
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        createdAt: true,
      },
    })

    await logAuditAction({
      actor: session.user,
      actionType: "ADMIN_CREATE_ADMIN",
      targetType: "user",
      targetId: newAdmin.id,
      details: { email: newAdmin.email, name: newAdmin.name, roles: newAdmin.roles },
    })

    return NextResponse.json(
      {
        admin: newAdmin,
        message: "Admin created successfully",
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      )
    }
    console.error("Error creating admin:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
