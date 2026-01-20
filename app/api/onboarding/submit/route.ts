import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { onboardingSubmitSchema } from "@/lib/validations"
import { bodyFatRangeToPercentage, completeOnboardingCalculation } from "@/lib/calculations/fitness"
import { lbsToKg, inchesToCm } from "@/lib/utils/unit-conversions"
import { NextResponse } from "next/server"

/**
 * POST /api/onboarding/submit
 * Submits completed onboarding form and creates user profile, goals, and baseline entry
 */
export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isClient(session.user)) {
    return NextResponse.json({ error: "Only clients can complete onboarding" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = onboardingSubmitSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const data = parsed.data

    // Get body fat percentage from range
    const bodyFatPercentage = await bodyFatRangeToPercentage(data.bodyFatRange)

    // Verify calculations are correct (re-calculate to validate)
    const calculations = await completeOnboardingCalculation({
      weightKg: data.currentWeightKg,
      heightCm: data.heightCm,
      birthDate: data.birthDate,
      sex: data.sex as "male" | "female",
      activityLevel: data.activityLevel as "not_much" | "light" | "moderate" | "heavy",
      primaryGoal: data.primaryGoal as "lose_weight" | "maintain_weight" | "gain_weight",
      targetWeightKg: data.targetWeightKg,
    })

    // Convert weight and height back to imperial for Entry model (which uses lbs/inches)
    const weightLbs = data.currentWeightKg / 0.453592
    const heightInches = data.heightCm / 2.54

    // Use database transaction to ensure atomic updates
    const result = await db.$transaction(async (tx) => {
      // Update user with profile information
      const updatedUser = await tx.user.update({
        where: { id: session.user.id },
        data: {
          gender: data.sex,
          dateOfBirth: new Date(data.birthDate),
          activityLevel: data.activityLevel,
          primaryGoal: data.primaryGoal,
          onboardingComplete: true,
        },
        select: { id: true, email: true },
      })

      // Create or update UserPreference
      const preference = await tx.userPreference.upsert({
        where: { userId: session.user.id },
        update: {
          weightUnit: data.weightUnit,
          measurementUnit: data.measurementUnit,
          dateFormat: data.dateFormat,
        },
        create: {
          userId: session.user.id,
          weightUnit: data.weightUnit,
          measurementUnit: data.measurementUnit,
          dateFormat: data.dateFormat,
        },
      })

      // Create or update UserGoals
      const goals = await tx.userGoals.upsert({
        where: { userId: session.user.id },
        update: {
          currentWeightKg: data.currentWeightKg,
          targetWeightKg: data.targetWeightKg,
          heightCm: data.heightCm,
          dailyCaloriesKcal: data.dailyCaloriesKcal,
          proteinGrams: data.proteinGrams,
          carbGrams: data.carbGrams,
          fatGrams: data.fatGrams,
          waterIntakeMl: data.waterIntakeMl,
          dailyStepsTarget: data.dailyStepsTarget || null,
          weeklyWorkoutMinutes: data.weeklyWorkoutMinutes || null,
        },
        create: {
          userId: session.user.id,
          currentWeightKg: data.currentWeightKg,
          targetWeightKg: data.targetWeightKg,
          heightCm: data.heightCm,
          dailyCaloriesKcal: data.dailyCaloriesKcal,
          proteinGrams: data.proteinGrams,
          carbGrams: data.carbGrams,
          fatGrams: data.fatGrams,
          waterIntakeMl: data.waterIntakeMl,
          dailyStepsTarget: data.dailyStepsTarget || null,
          weeklyWorkoutMinutes: data.weeklyWorkoutMinutes || null,
        },
      })

      // Create baseline Entry with today's date (use Date object, not string)
      const today = new Date()
      today.setHours(0, 0, 0, 0) // Normalize to midnight

      const baselineEntry = await tx.entry.upsert({
        where: {
          userId_date: {
            userId: session.user.id,
            date: today,
          },
        },
        update: {
          weightLbs,
          heightInches,
          bodyFatPercentage,
          customResponses: {
            onboardingData: {
              activityLevel: data.activityLevel,
              primaryGoal: data.primaryGoal,
              bodyFatRange: data.bodyFatRange,
              addBurnedCalories: data.addBurnedCalories,
            },
          },
          dataSources: ["onboarding"],
        },
        create: {
          userId: session.user.id,
          date: today,
          weightLbs,
          heightInches,
          bodyFatPercentage,
          customResponses: {
            onboardingData: {
              activityLevel: data.activityLevel,
              primaryGoal: data.primaryGoal,
              bodyFatRange: data.bodyFatRange,
              addBurnedCalories: data.addBurnedCalories,
            },
          },
          dataSources: ["onboarding"],
        },
      })

      return {
        user: updatedUser,
        preference,
        goals,
        baselineEntry,
      }
    })

    return NextResponse.json({
      data: {
        message: "Onboarding completed successfully",
        onboardingComplete: true,
        user: result.user,
        goals: result.goals,
        preference: result.preference,
      },
    })
  } catch (error) {
    console.error("Error submitting onboarding:", error)
    return NextResponse.json(
      { error: "Failed to complete onboarding" },
      { status: 500 }
    )
  }
}
