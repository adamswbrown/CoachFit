"use client"

import { useEffect, useMemo, useState } from "react"

const KCAL_PER_GRAM = {
  carb: 4,
  protein: 4,
  fat: 9,
}

export type MacroPercents = {
  proteinPercent: number
  carbPercent: number
  fatPercent: number
}

export type PlanReviewRanges = {
  minDailyCalories: number
  maxDailyCalories: number
  minProteinPerLb: number
  maxProteinPerLb: number
  defaultMacroPercents: MacroPercents
}

// NOTE: PlanReviewPlan is now simplified for coach-facing use only
export type PlanReviewPlan = {
  bmr: number
  tdee: number
  dailyCaloriesKcal: number
  currentWeightKg: number
  weightLbs: number
  dailyStepsTarget?: number
}

export type PlanReviewOnSavePayload = {
  dailyCaloriesKcal: number
  dailyStepsTarget?: number
}

interface PlanReviewProps {
  plan: PlanReviewPlan | null
  isSaving?: boolean
  onSave: (payload: PlanReviewOnSavePayload) => void
}

/**
/**
 * Presentational plan review component for onboarding.
 * Only shows daily calories and steps. Plan is for coach, not member.
 */
export function PlanReview({ plan, isSaving = false, onSave }: PlanReviewProps) {
  const [editMode, setEditMode] = useState(false)
  const [localCalories, setLocalCalories] = useState<number>(plan?.dailyCaloriesKcal ?? 0)
  const [localSteps, setLocalSteps] = useState<number | undefined>(plan?.dailyStepsTarget)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (plan) {
      setLocalCalories(plan.dailyCaloriesKcal)
      setLocalWater(plan.waterIntakeMl)
      setLocalSteps(plan.dailyStepsTarget)
      setLocalWorkoutMinutes(plan.weeklyWorkoutMinutes)
    }
  }, [plan])

  useEffect(() => {
    setLocalPercents(macroPercents)
  }, [macroPercents])

  const macroSum = useMemo(
    () => localPercents.carbPercent + localPercents.proteinPercent + localPercents.fatPercent,
    [localPercents]
  )

  if (!plan) {
    return (
      <div className="space-y-4">
        <div className="h-20 bg-gray-100 animate-pulse rounded-lg" />
        <div className="h-40 bg-gray-100 animate-pulse rounded-lg" />
      </div>
    )
  }

  const handleValidate = (): boolean => {
    const nextErrors: Record<string, string> = {}

    if (localCalories < ranges.minDailyCalories || localCalories > ranges.maxDailyCalories) {
      nextErrors.calories = `Calories must be between ${ranges.minDailyCalories} and ${ranges.maxDailyCalories} kcal`
    }

    if (Math.abs(macroSum - 100) > 0.1) {
      nextErrors.macros = "Macro percentages must total 100%"
    }

    // Compute protein per lb from percents to validate against per-lb range
    const derivedProteinGrams = Math.round((localCalories * (localPercents.proteinPercent / 100)) / KCAL_PER_GRAM.protein)
    const proteinPerLb = plan.weightLbs > 0 ? derivedProteinGrams / plan.weightLbs : 0
    if (proteinPerLb < ranges.minProteinPerLb) {
      nextErrors.protein = `Protein must be at least ${(ranges.minProteinPerLb * plan.weightLbs).toFixed(1)}g (${ranges.minProteinPerLb}g/lb)`
    }
    if (proteinPerLb > ranges.maxProteinPerLb) {
      nextErrors.protein = `Protein must not exceed ${(ranges.maxProteinPerLb * plan.weightLbs).toFixed(1)}g (${ranges.maxProteinPerLb}g/lb)`
    }

    if (localWater < 0) {
      nextErrors.water = "Water cannot be negative"
    }
    if (localSteps !== undefined && localSteps < 0) {
      nextErrors.steps = "Steps cannot be negative"
    }
    if (localWorkoutMinutes !== undefined && localWorkoutMinutes < 0) {
      nextErrors.workouts = "Workout minutes cannot be negative"
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSave = () => {
    if (isSaving) return
    if (!handleValidate()) return

    const proteinGrams = Math.round((localCalories * (localPercents.proteinPercent / 100)) / KCAL_PER_GRAM.protein)
    const carbGrams = Math.round((localCalories * (localPercents.carbPercent / 100)) / KCAL_PER_GRAM.carb)
    const fatGrams = Math.round((localCalories * (localPercents.fatPercent / 100)) / KCAL_PER_GRAM.fat)

    onSave({
      dailyCaloriesKcal: localCalories,
      proteinGrams,
      carbGrams,
      fatGrams,
      waterIntakeMl: localWater,
      dailyStepsTarget: localSteps,
      weeklyWorkoutMinutes: localWorkoutMinutes,
      macroPercents: { ...localPercents },
    })

    setEditMode(false)
  }

  const resetToDefaults = () => {
    setLocalPercents(ranges.defaultMacroPercents)
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="BMR" value={plan.bmr} helper="kcal/day" color="blue" />
        <SummaryCard label="TDEE" value={plan.tdee} helper="kcal/day" color="green" />
        <SummaryCard label="Daily Goal" value={localCalories} helper="kcal/day" color="purple" />
        <SummaryCard label="Water" value={localWater} helper="ml/day" color="orange" />
      </div>

      <div className="bg-gray-50 p-4 sm:p-6 rounded-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Daily Macro Targets</h3>
            <p className="text-sm text-gray-600">Adjust percents; we convert to grams</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetToDefaults}
              className="text-sm text-neutral-600 hover:text-neutral-900 underline-offset-4 hover:underline"
              disabled={isSaving}
            >
              Reset to defaults
            </button>
            <button
              onClick={() => {
                setEditMode((prev) => !prev)
                setErrors({})
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              disabled={isSaving}
            >
              {editMode ? "Cancel" : "Edit"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledNumber
            label="Daily calories"
            value={localCalories}
            onChange={(v) => setLocalCalories(isNaN(v) ? 0 : v)}
            suffix="kcal"
            disabled={!editMode || isSaving}
            error={errors.calories}
            min={ranges.minDailyCalories}
            max={ranges.maxDailyCalories}
          />
          <LabeledNumber
            label="Water"
            value={localWater}
            onChange={(v) => setLocalWater(isNaN(v) ? 0 : v)}
            suffix="ml"
            disabled={!editMode || isSaving}
            error={errors.water}
            min={0}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <MacroInput
            label="Protein"
            percent={localPercents.proteinPercent}
            onChange={(v) => setLocalPercents((p) => ({ ...p, proteinPercent: v }))}
            disabled={!editMode || isSaving}
            color="red"
          />
          <MacroInput
            label="Carbs"
            percent={localPercents.carbPercent}
            onChange={(v) => setLocalPercents((p) => ({ ...p, carbPercent: v }))}
            disabled={!editMode || isSaving}
            color="yellow"
          />
          <MacroInput
            label="Fat"
            percent={localPercents.fatPercent}
            onChange={(v) => setLocalPercents((p) => ({ ...p, fatPercent: v }))}
            disabled={!editMode || isSaving}
            color="amber"
          />
        </div>
        {errors.macros && <p className="text-sm text-red-600">{errors.macros}</p>}
        {errors.protein && <p className="text-sm text-red-600">{errors.protein}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LabeledNumber
            label="Daily steps target"
            value={localSteps ?? 0}
            onChange={(v) => setLocalSteps(isNaN(v) ? undefined : v)}
            suffix="steps"
            disabled={!editMode || isSaving}
            error={errors.steps}
            min={0}
          />
          <LabeledNumber
            label="Weekly workout minutes"
            value={localWorkoutMinutes ?? 0}
            onChange={(v) => setLocalWorkoutMinutes(isNaN(v) ? undefined : v)}
            suffix="min"
            disabled={!editMode || isSaving}
            error={errors.workouts}
            min={0}
          />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-900">
          <strong>Medical Disclaimer:</strong> These calculations are estimates based on the Mifflin-St Jeor equation. Consult with a healthcare professional before making significant changes to your diet or exercise routine.
        </p>
      </div>

      {editMode && (
        <button
          onClick={handleSave}
          className="w-full px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  helper,
  color,
}: {
  label: string
  value: number
  helper: string
  color: "blue" | "green" | "purple" | "orange"
}) {
  const palette: Record<typeof color, string> = {
    blue: "from-blue-50 to-blue-100 text-blue-900",
    green: "from-green-50 to-green-100 text-green-900",
    purple: "from-purple-50 to-purple-100 text-purple-900",
    orange: "from-orange-50 to-orange-100 text-orange-900",
  }

  return (
    <div className={`bg-gradient-to-br ${palette[color]} p-4 rounded-lg`}>
      <p className="text-sm text-gray-700">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-gray-600">{helper}</p>
    </div>
  )
}

function MacroInput({
  label,
  percent,
  onChange,
  disabled,
  color,
}: {
  label: string
  percent: number
  onChange: (value: number) => void
  disabled: boolean
  color: "red" | "yellow" | "amber"
}) {
  const palette: Record<typeof color, string> = {
    red: "from-red-100 to-red-50 text-red-900",
    yellow: "from-yellow-100 to-yellow-50 text-yellow-900",
    amber: "from-amber-100 to-amber-50 text-amber-900",
  }

  return (
    <div className={`bg-gradient-to-br ${palette[color]} p-4 rounded-lg`}>
      <p className="text-sm text-gray-700 mb-2">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={percent}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-2 py-1 border border-gray-300 rounded"
          disabled={disabled}
          min={0}
          max={100}
        />
        <span className="text-sm text-gray-700">%</span>
      </div>
      <p className="text-xs text-gray-600 mt-1">Percent of daily calories</p>
    </div>
  )
}

function LabeledNumber({
  label,
  value,
  onChange,
  suffix,
  disabled,
  error,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  suffix?: string
  disabled: boolean
  error?: string
  min?: number
  max?: number
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-neutral-800 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-neutral-100"
          disabled={disabled}
          min={min}
          max={max}
        />
        {suffix && <span className="text-sm text-neutral-700">{suffix}</span>}
      </div>
      {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
    </div>
  )
}
