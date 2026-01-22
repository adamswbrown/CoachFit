import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"
import { Role } from "@/lib/types"
import {
  calculateMacros,
  calculateWaterGoal,
  completeOnboardingCalculation,
} from "@/lib/calculations/fitness"
import { getSystemSettings } from "@/lib/system-settings"

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

    // Only coaches or admins can view client plans
    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // If coach, must own at least one cohort with this client
    if (session.user.roles.includes(Role.COACH) && !session.user.roles.includes(Role.ADMIN)) {
      const membership = await db.cohortMembership.findFirst({
        where: {
          userId: id,
          Cohort: { coachId: session.user.id },
        },
      })
      if (!membership) {
        return NextResponse.json({ error: "Forbidden: Not your client" }, { status: 403 })
      }
    }

    const user = await db.user.findUnique({
      where: { id },
      select: {
        onboardingComplete: true,
        gender: true,
        dateOfBirth: true,
        activityLevel: true,
        primaryGoal: true,
        UserGoals: {
          select: {
            dailyCaloriesKcal: true,
            proteinGrams: true,
            carbGrams: true,
            fatGrams: true,
            waterIntakeMl: true,
            dailyStepsTarget: true,
            weeklyWorkoutMinutes: true,
            currentWeightKg: true,
            targetWeightKg: true,
            heightCm: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "Client not found." }, { status: 404 })
    }

    if (!user.onboardingComplete) {
      return NextResponse.json(
        { error: "Onboarding not completed.", reason: "onboarding_incomplete" },
        { status: 409 }
      )
    }

    const userGoals = user.UserGoals
    if (!userGoals) {
      return NextResponse.json(
        { error: "No personalized plan found for this client.", reason: "missing_goals" },
        { status: 404 }
      )
    }

    const mapActivityLevel = (
      level?: string | null
    ): "not_much" | "light" | "moderate" | "heavy" | null => {
      switch (level) {
        case "sedentary":
        case "not_much":
          return "not_much"
        case "lightly_active":
        case "light":
          return "light"
        case "active":
        case "moderate":
          return "moderate"
        case "very_active":
        case "extremely_active":
        case "heavy":
          return "heavy"
        default:
          return null
      }
    }

    const activityLevel = mapActivityLevel(user.activityLevel)
    const updates: Record<string, any> = {}

    const hasProfileInputs =
      user.gender &&
      user.dateOfBirth &&
      activityLevel &&
      user.primaryGoal &&
      userGoals.currentWeightKg &&
      userGoals.heightCm &&
      userGoals.targetWeightKg

    if (userGoals.dailyCaloriesKcal == null && hasProfileInputs) {
      const calculated = await completeOnboardingCalculation({
        weightKg: userGoals.currentWeightKg as number,
        heightCm: userGoals.heightCm as number,
        birthDate: user.dateOfBirth as Date,
        sex: user.gender as "male" | "female" | "prefer_not_to_say",
        activityLevel,
        primaryGoal: user.primaryGoal as "lose_weight" | "maintain_weight" | "gain_weight",
        targetWeightKg: userGoals.targetWeightKg as number,
      })

      if (userGoals.dailyCaloriesKcal == null) updates.dailyCaloriesKcal = calculated.dailyCaloriesKcal
      if (userGoals.proteinGrams == null) updates.proteinGrams = calculated.proteinGrams
      if (userGoals.carbGrams == null) updates.carbGrams = calculated.carbGrams
      if (userGoals.fatGrams == null) updates.fatGrams = calculated.fatGrams
      if (userGoals.waterIntakeMl == null) updates.waterIntakeMl = calculated.waterIntakeMl
      if (userGoals.dailyStepsTarget == null) updates.dailyStepsTarget = calculated.dailyStepsTarget
      if (userGoals.weeklyWorkoutMinutes == null) updates.weeklyWorkoutMinutes = calculated.weeklyWorkoutMinutes
    } else if (userGoals.dailyCaloriesKcal != null) {
      if (
        userGoals.proteinGrams == null ||
        userGoals.carbGrams == null ||
        userGoals.fatGrams == null
      ) {
        const macros = await calculateMacros(userGoals.dailyCaloriesKcal)
        if (userGoals.proteinGrams == null) updates.proteinGrams = macros.proteinGrams
        if (userGoals.carbGrams == null) updates.carbGrams = macros.carbGrams
        if (userGoals.fatGrams == null) updates.fatGrams = macros.fatGrams
      }

      if (userGoals.waterIntakeMl == null && userGoals.currentWeightKg != null) {
        updates.waterIntakeMl = calculateWaterGoal(userGoals.currentWeightKg)
      }

      if (
        (userGoals.dailyStepsTarget == null || userGoals.weeklyWorkoutMinutes == null) &&
        activityLevel
      ) {
        const settings = await getSystemSettings()
        if (userGoals.dailyStepsTarget == null) {
          switch (activityLevel) {
            case "not_much":
              updates.dailyStepsTarget = settings.stepsNotMuch ?? 5000
              break
            case "light":
              updates.dailyStepsTarget = settings.stepsLight ?? 7500
              break
            case "moderate":
              updates.dailyStepsTarget = settings.stepsModerate ?? 10000
              break
            case "heavy":
              updates.dailyStepsTarget = settings.stepsHeavy ?? 12500
              break
          }
        }

        if (userGoals.weeklyWorkoutMinutes == null) {
          switch (activityLevel) {
            case "not_much":
              updates.weeklyWorkoutMinutes = settings.workoutNotMuch ?? 75
              break
            case "light":
              updates.weeklyWorkoutMinutes = settings.workoutLight ?? 150
              break
            case "moderate":
              updates.weeklyWorkoutMinutes = settings.workoutModerate ?? 225
              break
            case "heavy":
              updates.weeklyWorkoutMinutes = settings.workoutHeavy ?? 300
              break
          }
        }
      }
    } else if (!hasProfileInputs) {
      return NextResponse.json(
        { error: "Missing profile data to calculate the plan.", reason: "missing_profile_data" },
        { status: 409 }
      )
    }

    const finalGoals =
      Object.keys(updates).length > 0
        ? await db.userGoals.update({
            where: { userId: id },
            data: updates,
            select: {
              dailyCaloriesKcal: true,
              proteinGrams: true,
              carbGrams: true,
              fatGrams: true,
              waterIntakeMl: true,
              dailyStepsTarget: true,
              weeklyWorkoutMinutes: true,
              currentWeightKg: true,
              targetWeightKg: true,
              heightCm: true,
            },
          })
        : userGoals

    return NextResponse.json({ plan: finalGoals }, { status: 200 })
  } catch (error) {
    console.error("Error fetching client plan:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
