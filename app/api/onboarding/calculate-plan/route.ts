import { auth } from "@/lib/auth"
import { isClient } from "@/lib/permissions"
import { completeOnboardingCalculation } from "@/lib/calculations/fitness"
import { NextResponse } from "next/server"
import { z } from "zod"

/**
 * POST /api/onboarding/calculate-plan
 * Calculate fitness plan based on onboarding data (server-side only)
 */

const calculatePlanSchema = z.object({
  weightKg: z.number().positive(),
  heightCm: z.number().positive(),
  birthDate: z.string(),
  sex: z.enum(["male", "female"]),
  activityLevel: z.enum(["not_much", "light", "moderate", "heavy"]),
  primaryGoal: z.enum(["lose_weight", "maintain_weight", "gain_weight"]),
  targetWeightKg: z.number().positive(),
})

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isClient(session.user)) {
    return NextResponse.json({ error: "Only clients can calculate plans" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = calculatePlanSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Calculate plan server-side (has access to system settings via Prisma)
    const plan = await completeOnboardingCalculation({
      weightKg: data.weightKg,
      heightCm: data.heightCm,
      birthDate: data.birthDate,
      sex: data.sex,
      activityLevel: data.activityLevel,
      primaryGoal: data.primaryGoal,
      targetWeightKg: data.targetWeightKg,
    })

    return NextResponse.json({ data: plan })
  } catch (error: any) {
    console.error("Error calculating plan:", error)
    return NextResponse.json(
      { error: error.message || "Failed to calculate plan" },
      { status: 500 }
    )
  }
}
