"use client"

import { useEffect, useRef } from "react"
import { Model } from "survey-core"
import { Survey } from "survey-react-ui"
import "survey-core/survey-core.min.css"
import { DEFAULT_SURVEY_CONFIG } from "@/lib/surveyjs-config"

interface SurveyContainerProps {
  surveyJson: any
  onComplete?: (survey: Model) => void
  onValueChanged?: (survey: Model) => void
  data?: any
  mode?: "edit" | "display"
}

export function SurveyContainer({
  surveyJson,
  onComplete,
  onValueChanged,
  data,
  mode = "edit",
}: SurveyContainerProps) {
  const surveyRef = useRef<Model | null>(null)

  useEffect(() => {
    // Create survey model
    const survey = new Model(surveyJson)
    
    // Apply default configuration
    Object.assign(survey, DEFAULT_SURVEY_CONFIG)
    
    // Set mode
    if (mode === "display") {
      survey.mode = "display"
    }
    
    // Set initial data if provided
    if (data) {
      survey.data = data
    }
    
    // Set up event handlers
    if (onComplete) {
      survey.onComplete.add((sender) => {
        onComplete(sender)
      })
    }
    
    if (onValueChanged) {
      survey.onValueChanged.add((sender) => {
        onValueChanged(sender)
      })
    }
    
    surveyRef.current = survey
    
    return () => {
      // Cleanup
      survey.dispose()
    }
  }, [surveyJson, onComplete, onValueChanged, data, mode])

  if (!surveyRef.current) {
    return <div>Loading survey...</div>
  }

  return <Survey model={surveyRef.current} />
}
