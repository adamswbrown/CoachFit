"use client"

import { useMemo, useState } from "react"
import { DEFAULT_TEMPLATES } from "@/lib/default-questionnaire-templates"
import { EmailEditor } from "@/components/admin/EmailEditor"

type WeekKey = "week1" | "week2" | "week3" | "week4" | "week5"
type QuestionType = "comment" | "number" | "html"

type Element = {
  type: "comment" | "text" | "html"
  name: string
  title?: string
  description?: string
  isRequired?: boolean
  rows?: number
  inputType?: string
  min?: number
  max?: number
  html?: string
}

type WeekTemplate = {
  title: string
  description?: string
  pages: Array<{
    name: string
    elements: Element[]
  }>
}

type Bundle = Record<WeekKey, WeekTemplate>

const WEEK_KEYS: WeekKey[] = ["week1", "week2", "week3", "week4", "week5"]

const ensureWeekTemplate = (weekKey: WeekKey, template?: any): WeekTemplate => {
  if (template && template.pages && Array.isArray(template.pages)) {
    return template as WeekTemplate
  }

  return {
    title: `Week ${weekKey.replace("week", "")} Check-In`,
    description: "",
    pages: [
      {
        name: weekKey,
        elements: [],
      },
    ],
  }
}

const normalizeBundle = (bundle?: any): Bundle => {
  const output = {} as Bundle
  WEEK_KEYS.forEach((weekKey) => {
    const weekTemplate = bundle?.[weekKey] ?? DEFAULT_TEMPLATES[weekKey]
    output[weekKey] = ensureWeekTemplate(weekKey, weekTemplate)
  })
  return output
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || `question_${Date.now()}`

interface QuestionnaireBuilderProps {
  bundle: any
  onChange: (bundle: Bundle) => void
  selectedWeek: WeekKey
  onWeekChange: (week: WeekKey) => void
}

export function QuestionnaireBuilder({
  bundle,
  onChange,
  selectedWeek,
  onWeekChange,
}: QuestionnaireBuilderProps) {
  const normalizedBundle = useMemo(() => normalizeBundle(bundle), [bundle])
  const weekTemplate = normalizedBundle[selectedWeek]
  const [newQuestionType, setNewQuestionType] = useState<QuestionType>("comment")

  const updateWeek = (nextWeek: WeekTemplate) => {
    onChange({
      ...normalizedBundle,
      [selectedWeek]: nextWeek,
    })
  }

  const updateElement = (index: number, patch: Partial<Element>) => {
    const elements = [...weekTemplate.pages[0].elements]
    elements[index] = { ...elements[index], ...patch }
    updateWeek({
      ...weekTemplate,
      pages: [{ ...weekTemplate.pages[0], elements }],
    })
  }

  const removeElement = (index: number) => {
    const elements = weekTemplate.pages[0].elements.filter((_, i) => i !== index)
    updateWeek({
      ...weekTemplate,
      pages: [{ ...weekTemplate.pages[0], elements }],
    })
  }

  const moveElement = (index: number, direction: "up" | "down") => {
    const elements = [...weekTemplate.pages[0].elements]
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= elements.length) return
    const [item] = elements.splice(index, 1)
    elements.splice(targetIndex, 0, item)
    updateWeek({
      ...weekTemplate,
      pages: [{ ...weekTemplate.pages[0], elements }],
    })
  }

  const addElement = () => {
    const baseName = slugify(
      newQuestionType === "html" ? "intro" : `question_${weekTemplate.pages[0].elements.length + 1}`
    )

    const element: Element =
      newQuestionType === "html"
        ? {
            type: "html",
            name: baseName,
            html: "<p>Intro text...</p>",
          }
        : newQuestionType === "number"
        ? {
            type: "text",
            name: baseName,
            title: "Number question",
            inputType: "number",
            min: 0,
            max: 7,
            isRequired: true,
          }
        : {
            type: "comment",
            name: baseName,
            title: "Long answer question",
            rows: 3,
            isRequired: true,
          }

    const elements = [...weekTemplate.pages[0].elements, element]
    updateWeek({
      ...weekTemplate,
      pages: [{ ...weekTemplate.pages[0], elements }],
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3">
        <label className="text-xs text-neutral-600">
          Week Title
          <input
            type="text"
            value={weekTemplate.title}
            onChange={(e) => updateWeek({ ...weekTemplate, title: e.target.value })}
            className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
          />
        </label>
        <label className="text-xs text-neutral-600">
          Week Description
          <input
            type="text"
            value={weekTemplate.description || ""}
            onChange={(e) => updateWeek({ ...weekTemplate, description: e.target.value })}
            className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <label className="text-sm font-medium text-neutral-700">
          Week
        </label>
        <select
          value={selectedWeek}
          onChange={(e) => onWeekChange(e.target.value as WeekKey)}
          className="px-3 py-2 border rounded-md text-sm"
        >
          {WEEK_KEYS.map((weekKey) => (
            <option key={weekKey} value={weekKey}>
              {weekKey.replace("week", "Week ")}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <label className="text-sm font-medium text-neutral-700">Add</label>
        <select
          value={newQuestionType}
          onChange={(e) => setNewQuestionType(e.target.value as QuestionType)}
          className="px-3 py-2 border rounded-md text-sm"
        >
          <option value="comment">Long Text</option>
          <option value="number">Number</option>
          <option value="html">Intro Text</option>
        </select>
        <button
          type="button"
          onClick={addElement}
          className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
        >
          Add Question
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {weekTemplate.pages[0].elements.map((element, index) => (
          <div key={`${element.name}-${index}`} className="border rounded-lg p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-neutral-800">
                {element.type === "html"
                  ? "Intro Text"
                  : element.type === "comment"
                  ? "Long Text"
                  : "Number"}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => moveElement(index, "up")}
                  className="text-xs px-2 py-1 border rounded-md"
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => moveElement(index, "down")}
                  className="text-xs px-2 py-1 border rounded-md"
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => removeElement(index)}
                  className="text-xs px-2 py-1 border rounded-md text-red-600"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <label className="text-xs text-neutral-600">
                Field Key
                <input
                  type="text"
                  value={element.name}
                  onChange={(e) => updateElement(index, { name: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                />
              </label>

              {element.type === "html" ? (
                <label className="text-xs text-neutral-600">
                  Intro Text
                  <div className="mt-2">
                    <EmailEditor
                      content={element.html || ""}
                      onChange={(html) => updateElement(index, { html })}
                    />
                  </div>
                </label>
              ) : (
                <>
                  <label className="text-xs text-neutral-600">
                    Title
                    <div className="mt-2">
                      <EmailEditor
                        content={element.title || ""}
                        onChange={(html) => updateElement(index, { title: html })}
                        minHeightClassName="min-h-[120px]"
                      />
                    </div>
                  </label>
                  <label className="text-xs text-neutral-600">
                    Description
                    <div className="mt-2">
                      <EmailEditor
                        content={element.description || ""}
                        onChange={(html) => updateElement(index, { description: html })}
                        minHeightClassName="min-h-[160px]"
                      />
                    </div>
                  </label>
                  {element.type === "comment" && (
                    <label className="text-xs text-neutral-600">
                      Rows
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={element.rows || 3}
                        onChange={(e) => updateElement(index, { rows: parseInt(e.target.value) || 3 })}
                        className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                      />
                    </label>
                  )}
                  <label className="flex items-center gap-2 text-xs text-neutral-600">
                    <input
                      type="checkbox"
                      checked={element.isRequired ?? false}
                      onChange={(e) => updateElement(index, { isRequired: e.target.checked })}
                    />
                    Required
                  </label>
                  {element.type === "text" && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs text-neutral-600">
                        Min
                        <input
                          type="number"
                          value={element.min ?? 0}
                          onChange={(e) => updateElement(index, { min: parseInt(e.target.value) || 0 })}
                          className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </label>
                      <label className="text-xs text-neutral-600">
                        Max
                        <input
                          type="number"
                          value={element.max ?? 7}
                          onChange={(e) => updateElement(index, { max: parseInt(e.target.value) || 0 })}
                          className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                        />
                      </label>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
