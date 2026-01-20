"use client"

import { Survey } from "survey-react-ui"
import { StylesManager } from "survey-core"
import "survey-core/defaultV2.min.css"

interface SurveyContainerProps {
  survey: any
  onComplete?: (result: any) => void
  onValueChanged?: (result: any) => void
}

export function SurveyContainer({
  survey,
  onComplete,
  onValueChanged,
}: SurveyContainerProps) {
  // Apply theme
  StylesManager.applyTheme("default")

  if (onComplete) {
    survey.onComplete.add(onComplete)
  }

  if (onValueChanged) {
    survey.onValueChanged.add(onValueChanged)
  }

  return (
    <div className="w-full bg-white">
      <Survey model={survey} />
    </div>
  )
}
