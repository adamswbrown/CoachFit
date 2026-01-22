"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { ProgressBar } from "@/components/onboarding/ProgressBar"
import { SelectionGrid } from "@/components/onboarding/SelectionGrid"
import { UnitToggle } from "@/components/onboarding/UnitToggle"
import { NumericInput } from "@/components/onboarding/NumericInput"
import { DatePicker } from "@/components/onboarding/DatePicker"
import { PlanReview, PlanReviewOnSavePayload, PlanReviewRanges } from "@/components/onboarding/PlanReview"
import { lbsToKg, inchesToCm, kgToLbs } from "@/lib/utils/unit-conversions"

const BASE_STEPS = 8
const INTERSTITIAL_STEP = BASE_STEPS + 1
const PLAN_REVIEW_STEP = BASE_STEPS + 2

const DEFAULT_PLAN_RANGES: PlanReviewRanges = {
  minDailyCalories: 1000,
  maxDailyCalories: 5000,
  minProteinPerLb: 0.4,
  maxProteinPerLb: 2.0,
}

interface OnboardingData {
  name: string
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
  // addBurnedCalories removed
}

export default function ClientOnboarding() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showInterstitial, setShowInterstitial] = useState(false)
  const [calculatedPlan, setCalculatedPlan] = useState<any>(null)
  // Personalized plan is now coach-only; never shown to member
    const [showPersonalizedPlan, setShowPersonalizedPlan] = useState(false)
    const [configLoading, setConfigLoading] = useState(true)
  // macroPercents state removed

  const [data, setData] = useState<OnboardingData>({
    name: "",
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
    // addBurnedCalories removed
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [router, status])

  useEffect(() => {
    if (session?.user?.name) {
      setData((prev) => ({ ...prev, name: prev.name || session.user.name || "" }))
    }
  }, [session])

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const res = await fetch("/api/onboarding/preferences")
        if (res.status === 401) return
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

  // No longer load showPersonalizedPlan from config; always false
  useEffect(() => {
    setShowPersonalizedPlan(false)
    setConfigLoading(false)
  }, [])

  const updateData = (field: string, value: any) => {
    setData((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: "" }))
  }

  // deriveMacroPercents removed

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {}

    switch (currentStep) {
      case 1:
        if (!data.name.trim()) newErrors.name = "Please enter your name"
        break
      case 2:
        if (!data.sex) newErrors.sex = "Please select your sex"
        break
      case 3:
        if (!data.primaryGoal) newErrors.primaryGoal = "Please select a goal"
        break
      case 4:
        if (!data.currentWeight || Number(data.currentWeight) <= 0)
          newErrors.currentWeight = "Please enter a valid weight"
        break
      case 5:
        if (!data.height || Number(data.height) <= 0)
          newErrors.height = "Please enter a valid height"
        break
      case 6:
        if (!data.birthDate) newErrors.birthDate = "Please select a birth date"
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

    if (step === BASE_STEPS) {
      if (configLoading) {
        setErrors({ submit: "Loading onboarding settings. Please wait a moment." })
        return
      }

      // Plan is not shown to member; skip plan step
      setStep(INTERSTITIAL_STEP)
    } else if (step < BASE_STEPS) {
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
      if (!session?.user?.id) {
        throw new Error("Your session expired. Please sign in again.")
      }

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
        credentials: "include",
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

      if (response.status === 401) {
        throw new Error("Your session expired. Please sign in again.")
      }

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
      // setMacroPercents removed
      setStep(PLAN_REVIEW_STEP)
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
            dailyStepsTarget: payload.dailyStepsTarget,
          }
        : prev
    )
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
        name: data.name.trim(),
        sex: data.sex,
        primaryGoal: data.primaryGoal,
        currentWeightKg,
        heightCm,
        birthDate: data.birthDate,
        // bodyFatRange removed
        targetWeightKg,
        activityLevel: data.activityLevel,
        // addBurnedCalories removed
        weightUnit: data.weightUnit,
        measurementUnit: data.measurementUnit,
        dateFormat: data.dateFormat,
        dailyCaloriesKcal: calculatedPlan?.dailyCaloriesKcal,
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

  // Always hide personalized plan from client onboarding
  const totalSteps = INTERSTITIAL_STEP

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
            Welcome to CoachFit
          </h1>
          <p className="text-gray-600">
            {showPersonalizedPlan
              ? "Let's create your personalized fitness plan in just a few steps"
              : "Let's get your account ready in just a few steps"}
          </p>
        </div>

        {/* Progress Bar */}
        {step < totalSteps && <ProgressBar current={step} total={totalSteps} />}

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
          ) : step === INTERSTITIAL_STEP && !showPersonalizedPlan ? (
            <div className="py-6 text-center space-y-3">
              <h2 className="text-2xl font-bold text-gray-900">You're all set</h2>
              <p className="text-gray-600">
                We&apos;ll finish setting up your account when you continue.
              </p>
            </div>
          ) : step === 1 ? (
            // Step 1: Name
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">What&apos;s your name?</h2>
                <p className="text-gray-600 mb-4">
                  We&apos;ll use this for your account and coach communications.
                </p>
                <input
                  type="text"
                  value={data.name}
                  onChange={(event) => updateData("name", event.target.value)}
                  placeholder="Your full name"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {errors.name && <p className="text-red-600 text-sm">{errors.name}</p>}
            </div>
          ) : step === 2 ? (
            // Step 2: Sex + Unit Selection
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
                    { id: "prefer_not_to_say", label: "Prefer not to say" },
                  ]}
                  value={data.sex}
                  onChange={(value) => updateData("sex", value)}
                />
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Measurement units
                </h3>
                <p className="text-xs text-blue-700 mb-2">
                  <strong>Note:</strong> Coaches always work in pounds (lbs) and inches. All data is converted for coach-facing features.
                </p>
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
          ) : step === 3 ? (
            // Step 3: Primary Goal
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
          ) : step === 4 ? (
            // Step 4: Current Weight
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
          ) : step === 5 ? (
            // Step 5: Height
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
          ) : step === 6 ? (
            // Step 6: Birth Date
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
          ) : null}
          {/* PlanReview usage (coach-facing only, not shown in client onboarding) would go here, e.g.: */}
          {/* <PlanReview plan={calculatedPlan} isSaving={isLoading} onSave={handlePlanSave} ranges={DEFAULT_PLAN_RANGES} /> */}

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

            {step < totalSteps && (
              <button
                onClick={handleSkip}
                className="px-6 py-2 text-gray-600 hover:text-gray-900 font-medium transition-colors"
                disabled={isLoading}
              >
                Skip
              </button>
            )}

            <div className="flex-1" />

            {step < totalSteps ? (
              <button
                onClick={handleNext}
                className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                disabled={isLoading || (step === BASE_STEPS && configLoading)}
              >
                {step === BASE_STEPS ? "Continue" : "Next"}
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                disabled={isLoading}
              >
                {isLoading
                  ? "Completing..."
                  : showPersonalizedPlan
                  ? "Complete Onboarding"
                  : "Let's get started"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
