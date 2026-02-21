import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"

const BCRYPT_ROUNDS = 12

const createAdminSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Valid email is required"),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
})

/**
 * POST /api/setup/admin
 * Create the first admin user during setup.
 * Only accessible when setup is not complete.
 */
export async function POST(request: Request) {
  try {
    // Check if setup is already complete
    const settings = await db.systemSettings.findFirst({
      select: { setupComplete: true },
    })
    if (settings?.setupComplete) {
      return NextResponse.json({ error: "Setup already complete" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = createAdminSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { name, email, password } = parsed.data

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      )
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    // Create admin user
    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash,
        roles: ["ADMIN"],
        mustChangePassword: false,
        onboardingComplete: true,
        isTestUser: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        roles: true,
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        roles: user.roles,
      },
    })
  } catch (error) {
    console.error("Error creating admin user:", error)
    return NextResponse.json(
      { error: "Failed to create admin user" },
      { status: 500 }
    )
  }
}
