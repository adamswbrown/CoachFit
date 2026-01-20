"use client"

import { useEffect, useRef } from "react"
import { SurveyCreatorComponent } from "survey-creator-react"
import "survey-creator-core/survey-creator-core.min.css"

interface SurveyCreatorContainerProps {
  initialJson?: any
  onSave?: (json: any) => void
}

export function SurveyCreatorContainer({
  initialJson,
  onSave,
}: SurveyCreatorContainerProps) {
  const creatorRef = useRef<SurveyCreatorComponent>(null)

  useEffect(() => {
    if (creatorRef.current && initialJson) {
      const creator = creatorRef.current.surveyjsCreator
      creator.JSON = initialJson
    }
  }, [initialJson])

  const handleSave = () => {
    if (creatorRef.current && onSave) {
      const creator = creatorRef.current.surveyjsCreator
      onSave(creator.JSON)
    }
  }

  return (
    <div className="w-full">
      <SurveyCreatorComponent
        ref={creatorRef}
        options={{
          showLogicTab: true,
          showDesignerTab: true,
          showTestTab: false,
          showEmbeddedSurveyTab: false,
          showJSONEditorTab: true,
          showPreviewTab: true,
          showTranslationTab: false,
          showUndo: true,
          inlineEditDelay: 0,
        }}
      />
      <div className="mt-4 flex gap-2">
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Save Bundle
        </button>
      </div>
    </div>
  )
}
