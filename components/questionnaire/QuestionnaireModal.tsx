"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { SurveyContainer } from "./SurveyContainer"
import { WEEK_LABELS, WeekNumber } from "@/lib/surveyjs-config"
import { Model } from "survey-core"

interface QuestionnaireModalProps {
  cohortId: string
  weekNumber: WeekNumber
  isOpen: boolean
  onClose: () => void
}

export function QuestionnaireModal({
  cohortId,
  weekNumber,
  isOpen,
  onClose,
}: QuestionnaireModalProps) {
  const [surveyJson, setSurveyJson] = useState<any>(null)
  const [surveyData, setSurveyData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLocked, setIsLocked] = useState(false)
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null)

  // Debounce timer for auto-save
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const batchSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const pendingDataRef = useRef<any>(null)

  useEffect(() => {
    if (isOpen) {
      fetchQuestionnaire()
    }

    return () => {
      // Cleanup timers on unmount
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (batchSaveTimerRef.current) clearTimeout(batchSaveTimerRef.current)
    }
  }, [isOpen, cohortId, weekNumber])

  // Auto-save batch every 5 seconds
  useEffect(() => {
    if (isOpen && hasUnsavedChanges) {
      if (batchSaveTimerRef.current) {
        clearTimeout(batchSaveTimerRef.current)
      }

      batchSaveTimerRef.current = setTimeout(() => {
        if (pendingDataRef.current) {
          saveResponse(pendingDataRef.current, "in_progress")
        }
      }, 5000)
    }

    return () => {
      if (batchSaveTimerRef.current) {
        clearTimeout(batchSaveTimerRef.current)
      }
    }
  }, [hasUnsavedChanges, isOpen])

  const fetchQuestionnaire = async () => {
    try {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/weekly-questionnaire/${cohortId}/${weekNumber}`)

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to load questionnaire")
      }

      const data = await res.json()

      // Extract the specific week's questions from the bundle
      const bundle = data.bundleJson
      let weekTemplate = null

      if (bundle && typeof bundle === "object") {
        // Check if bundle has a structure like { week1: {...}, week2: {...}, ... }
        const weekKey = `week${weekNumber}`
        if (bundle[weekKey]) {
          weekTemplate = bundle[weekKey]
        } else {
          // Otherwise, assume the bundle itself is the template
          weekTemplate = bundle
        }
      }

      setSurveyJson(weekTemplate)
      setSurveyData(data.responseData)
      setHasUnsavedChanges(false)
      setIsLocked(Boolean(data.locked))
      setSubmittedAt(data.submittedAt ? new Date(data.submittedAt) : null)

      if (data.responseData) {
        setLastSavedAt(new Date())
      }
    } catch (err: any) {
      console.error("Error fetching questionnaire:", err)
      setError(err.message || "Failed to load questionnaire")
    } finally {
      setLoading(false)
    }
  }

  const saveResponse = async (data: any, status: "in_progress" | "completed") => {
    try {
      setSaving(true)
      setError(null)

      const res = await fetch(`/api/weekly-questionnaire/${cohortId}/${weekNumber}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseJson: data,
          status,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to save response")
      }

      setLastSavedAt(new Date())
      setHasUnsavedChanges(false)
      pendingDataRef.current = null
    } catch (err: any) {
      console.error("Error saving response:", err)
      setError(err.message || "Failed to save response")
    } finally {
      setSaving(false)
    }
  }

  const handleValueChanged = useCallback((survey: Model) => {
    const data = survey.data
    pendingDataRef.current = data
    setHasUnsavedChanges(true)

    // Debounced auto-save (500ms)
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = setTimeout(() => {
      saveResponse(data, "in_progress")
    }, 500)
  }, [cohortId, weekNumber])

  const handleComplete = useCallback(async (survey: Model) => {
    const data = survey.data
    await saveResponse(data, "completed")
    
    // Close modal after successful completion
    setTimeout(() => {
      onClose()
    }, 1000)
  }, [cohortId, weekNumber, onClose])

  const handleCloseClick = () => {
    if (hasUnsavedChanges) {
      if (!confirm("You have unsaved changes. Are you sure you want to close?")) {
        return
      }
    }
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center">
      <div className="relative bg-white w-full max-w-4xl mx-4 my-8 rounded-lg shadow-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {WEEK_LABELS[weekNumber]} Questionnaire
            </h2>
            {isLocked && submittedAt && (
              <p className="text-sm text-gray-500 mt-1">
                Submitted at {submittedAt.toLocaleString()}
              </p>
            )}
            {!isLocked && lastSavedAt && (
              <p className="text-sm text-gray-500 mt-1">
                {saving ? (
                  <span className="flex items-center gap-1">
                    <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  `Last saved at ${lastSavedAt.toLocaleTimeString()}`
                )}
              </p>
            )}
          </div>
          <button
            onClick={handleCloseClick}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <svg className="animate-spin h-8 w-8 mx-auto mb-4 text-blue-500" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <p className="text-gray-600">Loading questionnaire...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded mb-4">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {!loading && !error && surveyJson && (
            <>
              {isLocked && (
                <div className="bg-gray-50 border border-gray-200 text-gray-700 px-4 py-3 rounded mb-4">
                  <p className="font-medium">Responses locked</p>
                  <p className="text-sm">This questionnaire is read-only.</p>
                </div>
              )}
              <SurveyContainer
                surveyJson={surveyJson}
                data={surveyData}
                onValueChanged={isLocked ? undefined : handleValueChanged}
                onComplete={isLocked ? undefined : handleComplete}
                mode={isLocked ? "display" : "edit"}
              />
            </>
          )}

          {!loading && !error && !surveyJson && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded">
              <p className="font-medium">No questionnaire available</p>
              <p className="text-sm">Your coach hasn't set up a questionnaire for this cohort yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
