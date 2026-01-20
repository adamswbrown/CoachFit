"use client"

import { useEffect, useRef } from "react"
import { SurveyCreatorComponent, SurveyCreator } from "survey-creator-react"
import "survey-core/defaultV2.min.css"
import "survey-creator-core/survey-creator-core.min.css"
import { DEFAULT_CREATOR_CONFIG } from "@/lib/surveyjs-config"

interface SurveyCreatorContainerProps {
  json?: any
  onSaveClick?: (json: any) => void
}

export function SurveyCreatorContainer({
  json,
  onSaveClick,
}: SurveyCreatorContainerProps) {
  const creatorRef = useRef<SurveyCreator | null>(null)

  useEffect(() => {
    // Create survey creator
    const creator = new SurveyCreator(DEFAULT_CREATOR_CONFIG)
    
    // Set initial JSON if provided
    if (json) {
      creator.JSON = json
    } else {
      // Set a default empty survey
      creator.JSON = {
        pages: [
          {
            name: "page1",
            elements: [],
          },
        ],
      }
    }
    
    // Add save button handler
    if (onSaveClick) {
      creator.saveSurveyFunc = (saveNo: number, callback: (num: number, status: boolean) => void) => {
        onSaveClick(creator.JSON)
        callback(saveNo, true)
      }
    }
    
    creatorRef.current = creator
    
    return () => {
      // Cleanup if needed
    }
  }, [json, onSaveClick])

  if (!creatorRef.current) {
    return <div>Loading creator...</div>
  }

  return <SurveyCreatorComponent creator={creatorRef.current} />
}
