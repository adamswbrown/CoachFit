"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ProgressBar } from "@/components/onboarding/ProgressBar"
import { SelectionGrid } from "@/components/onboarding/SelectionGrid"
import { UnitToggle } from "@/components/onboarding/UnitToggle"
import { NumericInput } from "@/components/onboarding/NumericInput"
import { DatePicker } from "@/components/onboarding/DatePicker"
import { PlanReview, MacroPercents, PlanReviewOnSavePayload, PlanReviewRanges } from "@/components/onboarding/PlanReview"
import { lbsToKg, inchesToCm, kgToLbs } from "@/lib/utils/unit-conversions"

const TOTAL_STEPS = 11

const DEFAULT_PLAN_RANGES: PlanReviewRanges = {
  minDailyCalories: 1000,
  maxDailyCalories: 5000,
  minProteinPerLb: 0.4,
  maxProteinPerLb: 2.0,
  defaultMacroPercents: {
    proteinPercent: 30,
    carbPercent: 40,
    fatPercent: 30,
  },
}

interface OnboardingData {
  sex: string
  weightUnit: string
  measurementUnit: string
  dateFormat: string
  primaryGoal: string
  currentWeight: number | string
  height: number | string
  birthDate: string
  bodyFatRange: string
  targetWeight: number | string
  activityLevel: string
  addBurnedCalories: boolean
}

export default function ClientOnboarding() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showInterstitial, setShowInterstitial] = useState(false)
  const [calculatedPlan, setCalculatedPlan] = useState<any>(null)
  const [macroPercents, setMacroPercents] = useState<MacroPercents>({
    ...DEFAULT_PLAN_RANGES.defaultMacroPercents,
  })

  const [data, setData] = useState<OnboardingData>({
    sex: "",
    weightUnit: "lbs",
    measurementUnit: "inches",
    dateFormat: "MM/dd/yyyy",
    primaryGoal: "",
    currentWeight: "",
    height: "",
    birthDate: "",
    bodyFatRange: "",
    targetWeight: "",
    activityLevel: "",
    addBurnedCalories: false,
  })

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const res = await fetch("/api/onboarding/preferences")
        if (!res.ok) return
        const body = await res.json()
        const pref = body?.data?.preference
        if (!pref) return

        setData((prev) => ({
          ...prev,
          weightUnit: pref.weightUnit || prev.weightUnit,
          measurementUnit: pref.measurementUnit || prev.measurementUnit,
          dateFormat: pref.dateFormat || prev.dateFormat,
        }))
      } catch (error) {
        console.error("Failed to preload preferences", error)
      }
    }

    loadPreferences()
  }, [])

  const updateData = (field: string, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  const deriveMacroPercents = (plan: any): MacroPercents => {
    if (!plan?.dailyCaloriesKcal || plan.dailyCaloriesKcal === 0) {
      return DEFAULT_PLAN_RANGES.defaultMacroPercents
    }

    const calories = plan.dailyCaloriesKcal
    return {
      proteinPercent: Math.round(((plan.proteinGrams * 4) / calories) * 100),
      carbPercent: Math.round(((plan.carbGrams * 4) / calories) * 100),
      fatPercent: Math.round(((plan.fatGrams * 9) / calories) * 100),
    }
  }

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {}

    switch (currentStep) {
      case 1:
        if (!data.sex) newErrors.sex = "Please select your sex"
        break
      case 2:
        if (!data.primaryGoal) newErrors.primaryGoal = "Please select a goal"
        break
      case 3:
        if (!data.currentWeight || Number(data.currentWeight) <= 0)
          newErrors.currentWeight = "Please enter a valid weight"
        break
      case 4:
        if (!data.height || Number(data.height) <= 0)
          newErrors.height = "Please enter a valid height"
        break
      case 5:
        if (!data.birthDate) newErrors.birthDate = "Please select a birth date"
        break
      case 6:
        if (!data.bodyFatRange) newErrors.bodyFatRange = "Please select a body fat range"
        break
      case 7:
        if (!data.targetWeight || Number(data.targetWeight) <= 0)
          newErrors.targetWeight = "Please enter a valid target weight"
        break
      case 8:
        if (!data.activityLevel) newErrors.activityLevel = "Please select an activity level"
        break
      case 9:
        // No validation needed for boolean toggle
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = async () => {
    if (!validateStep(step)) return

    if (step === 9) {
      // Move to interstitial
      setShowInterstitial(true)
      setStep(10)
      // Auto-advance after 1 second
      setTimeout(() => {
        setShowInterstitial(false)
        // Calculate plan and move to step 11
        calculatePlan()
      }, 1000)
    } else if (step < 10) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleSkip = () => {
    router.push("/client-dashboard")
  }

  const calculatePlan = async () => {
    try {
      const currentWeightKg =
        data.weightUnit === "kg"
          ? Number(data.currentWeight)
          : lbsToKg(Number(data.currentWeight))

      const heightCm =
        data.measurementUnit === "cm"
          ? Number(data.height)
          : inchesToCm(Number(data.height))

      const targetWeightKg =
        data.weightUnit === "kg"
          ? Number(data.targetWeight)
          : lbsToKg(Number(data.targetWeight))

      // Call server API to calculate plan (server-side only, accesses system settings)
      const response = await fetch("/api/onboarding/calculate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          weightKg: currentWeightKg,
          heightCm: heightCm,
          birthDate: data.birthDate,
          sex: data.sex,
          activityLevel: data.activityLevel,
          primaryGoal: data.primaryGoal,
          targetWeightKg: targetWeightKg,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "Failed to calculate plan")
      }

      const { data: plan } = await response.json()

      setCalculatedPlan({
        ...plan,
        currentWeightKg,
        heightCm,
        targetWeightKg,
        weightLbs: kgToLbs(currentWeightKg),
      })
      setMacroPercents(deriveMacroPercents(plan))
      setStep(11)
    } catch (error) {
      console.error("Error calculating plan:", error)
      setErrors({ submit: error instanceof Error ? error.message : "Failed to calculate plan. Please try again." })
    }
  }

  const handlePlanSave = (payload: PlanReviewOnSavePayload) => {
    setCalculatedPlan((prev: any) =>
      prev
        ? {
            ...prev,
            dailyCaloriesKcal: payload.dailyCaloriesKcal,
            proteinGrams: payload.proteinGrams,
            carbGrams: payload.carbGrams,
            fatGrams: payload.fatGrams,
            waterIntakeMl: payload.waterIntakeMl,
            dailyStepsTarget: payload.dailyStepsTarget,
            weeklyWorkoutMinutes: payload.weeklyWorkoutMinutes,
          }
        : prev
    )

    setMacroPercents(payload.macroPercents)
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const currentWeightKg =
        data.weightUnit === "kg"
          ? Number(data.currentWeight)
          : lbsToKg(Number(data.currentWeight))

      const heightCm =
        data.measurementUnit === "cm"
          ? Number(data.height)
          : inchesToCm(Number(data.height))

      const targetWeightKg =
        data.weightUnit === "kg"
          ? Number(data.targetWeight)
          : lbsToKg(Number(data.targetWeight))

      const submitData = {
        sex: data.sex,
        primaryGoal: data.primaryGoal,
        currentWeightKg,
        heightCm,
        birthDate: data.birthDate,
        bodyFatRange: data.bodyFatRange,
        targetWeightKg,
        activityLevel: data.activityLevel,
        addBurnedCalories: data.addBurnedCalories,
        weightUnit: data.weightUnit,
        measurementUnit: data.measurementUnit,
        dateFormat: data.dateFormat,
        dailyCaloriesKcal: calculatedPlan.dailyCaloriesKcal,
        proteinGrams: calculatedPlan.proteinGrams,
        carbGrams: calculatedPlan.carbGrams,
        fatGrams: calculatedPlan.fatGrams,
        waterIntakeMl: calculatedPlan.waterIntakeMl,
      }

      const response = await fetch("/api/onboarding/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to complete onboarding")
      }

      // Redirect to client dashboard
      router.push("/client-dashboard")
    } catch (error) {
      console.error("Error submitting onboarding:", error)
      setErrors({
        submit:
          error instanceof Error ? error.message : "Failed to complete onboarding",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Welcome to CoachFit
          </h1>
          <p className="text-gray-600">
            Let's create your personalized fitness plan in just a few steps
          </p>
        </div>

        {/* Progress Bar */}
        {step < 11 && <ProgressBar current={step} total={TOTAL_STEPS} />}

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 mt-8">
          {showInterstitial ? (
            // Interstitial Step 10
            <div className="py-12 text-center">
              <div className="animate-spin mx-auto w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Preparing your personalized plan...
              </h2>
              <p className="text-gray-600">Just a moment while we calculate your targets</p>
            </div>
          ) : step === 1 ? (
            // Step 1: Sex + Unit Selection
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Your biological sex</h2>
                <p className="text-gray-600 mb-4">
                  This helps us calculate your metabolic needs accurately
                </p>
                <SelectionGrid
                  options={[
                    { id: "male", label: "Male" },
                    { id: "female", label: "Female" },
                  ]}
                  value={data.sex}
                  onChange={(value) => updateData("sex", value)}
                />
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Measurement units
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Weight</p>
                    <UnitToggle
                      value={data.weightUnit}
                      onChange={(value) => updateData("weightUnit", value)}
                      unit1="lbs"
                      unit1Label="Pounds (lbs)"
                      unit2="kg"
                      unit2Label="Kilograms (kg)"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700 mb-2">Height</p>
                    <UnitToggle
                      value={data.measurementUnit}
                      onChange={(value) => updateData("measurementUnit", value)}
                      unit1="inches"
                      unit1Label="Inches (in)"
                      unit2="cm"
                      unit2Label="Centimeters (cm)"
                    />
                  </div>
                </div>
              </div>

              {errors.sex && <p className="text-red-600 text-sm">{errors.sex}</p>}
            </div>
          ) : step === 2 ? (
            // Step 2: Primary Goal
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">What's your primary goal?</h2>
                <SelectionGrid
                  options={[
                    { id: "lose_weight", label: "Lose Weight" },
                    { id: "maintain_weight", label: "Maintain Weight" },
                    { id: "gain_weight", label: "Gain Weight" },
                  ]}
                  value={data.primaryGoal}
                  onChange={(value) => updateData("primaryGoal", value)}
                />
              </div>
              {errors.primaryGoal && (
                <p className="text-red-600 text-sm">{errors.primaryGoal}</p>
              )}
            </div>
          ) : step === 3 ? (
            // Step 3: Current Weight
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Current weight</h2>
                <NumericInput
                  value={data.currentWeight}
                  onChange={(value) => updateData("currentWeight", value)}
                  min={50}
                  max={1000}
                  step={0.1}
                  unit={data.weightUnit === "kg" ? "kg" : "lbs"}
                  placeholder="0"
                  error={errors.currentWeight}
                />
              </div>
            </div>
          ) : step === 4 ? (
            // Step 4: Height
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Height</h2>
                <NumericInput
                  value={data.height}
                  onChange={(value) => updateData("height", value)}
                  min={30}
                  max={300}
                  step={0.1}
                  unit={data.measurementUnit === "cm" ? "cm" : "inches"}
                  placeholder="0"
                  error={errors.height}
                />
              </div>
            </div>
          ) : step === 5 ? (
            // Step 5: Birth Date
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Birth date</h2>
                <DatePicker
                  value={data.birthDate}
                  onChange={(value) => updateData("birthDate", value)}
                  format={data.dateFormat}
                  error={errors.birthDate}
                />
              </div>
            </div>
          ) : step === 6 ? (
            // Step 6: Body Fat Range
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Body fat estimate</h2>
                <p className="text-gray-600 mb-4">
                  If unsure, start with Medium
                </p>
                <SelectionGrid
                  options={[
                    {
                      id: "low",
                      label: "Low",
                      description: "&lt;15%",
                    },
                    {
                      id: "medium",
                      label: "Medium",
                      description: "15–25%",
                    },
                    {
                      id: "high",
                      label: "High",
                      description: "25–35%",
                    },
                    {
                      id: "very_high",
                      label: "Very High",
                      description: "&gt;35%",
                    },
                  ]}
                  value={data.bodyFatRange}
                  onChange={(value) => updateData("bodyFatRange", value)}
                  columns={2}
                />
              </div>
              {errors.bodyFatRange && (
                <p className="text-red-600 text-sm">{errors.bodyFatRange}</p>
              )}
            </div>
          ) : step === 7 ? (
            // Step 7: Target Weight
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Target weight</h2>
                <NumericInput
                  value={data.targetWeight}
                  onChange={(value) => updateData("targetWeight", value)}
                  min={50}
                  max={1000}
                  step={0.1}
                  unit={data.weightUnit === "kg" ? "kg" : "lbs"}
                  placeholder="0"
                  error={errors.targetWeight}
                />
              </div>
            </div>
          ) : step === 8 ? (
            // Step 8: Activity Level
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Activity level</h2>
                <SelectionGrid
                  options={[
                    {
                      id: "not_much",
                      label: "Not Much",
                      description: "Sedentary",
                    },
                    {
                      id: "light",
                      label: "Light",
                      description: "1–2 days/week",
                    },
                    {
                      id: "moderate",
                      label: "Moderate",
                      description: "3–5 days/week",
                    },
                    {
                      id: "heavy",
                      label: "Heavy",
                      description: "6–7 days/week",
                    },
                  ]}
                  value={data.activityLevel}
                  onChange={(value) => updateData("activityLevel", value)}
                  columns={2}
                />
              </div>
              {errors.activityLevel && (
                <p className="text-red-600 text-sm">{errors.activityLevel}</p>
              )}
            </div>
          ) : step === 9 ? (
            // Step 9: Burned Calories Toggle
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Add burned calories back?
                </h2>
                <p className="text-gray-600 mb-4">
                  If you want to consume extra calories on exercise days
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => updateData("addBurnedCalories", true)}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                      data.addBurnedCalories
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => updateData("addBurnedCalories", false)}
                    className={`flex-1 py-3 px-4 rounded-lg font-medium transition-colors ${
                      !data.addBurnedCalories
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>
          ) : step === 11 && calculatedPlan ? (
            // Step 11: Plan Review (handled by separate component)
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Your personalized plan</h2>
              <PlanReview
                plan={{
                  ...calculatedPlan,
                  weightLbs:
                    calculatedPlan.weightLbs ?? kgToLbs(calculatedPlan.currentWeightKg ?? 0),
                }}
                macroPercents={macroPercents}
                ranges={DEFAULT_PLAN_RANGES}
                isSaving={isLoading}
                onSave={handlePlanSave}
              />
            </div>
          ) : null}

          {/* Error Messages */}
          {errors.submit && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{errors.submit}</p>
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex gap-3 justify-between">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="px-6 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg font-medium transition-colors"
                disabled={isLoading}
              >
                Back
              </button>
            )}

            {step < 11 && (
              <button
                onClick={handleSkip}
                className="px-6 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                disabled={isLoading}
              >
                Skip
              </button>
            )}

            <div className="flex-1" />

            {step < 11 ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                disabled={isLoading}
              >
                {step === 9 ? "Continue" : "Next"}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading ? "Completing..." : "Complete Onboarding"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
