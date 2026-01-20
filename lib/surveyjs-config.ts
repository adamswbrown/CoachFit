/**
 * SurveyJS Configuration
 * 
 * This file contains configuration for SurveyJS components including
 * license keys (if needed) and default settings for surveys and creator.
 */

// License key (if using commercial license)
// Replace with actual license key when available
export const SURVEYJS_LICENSE = process.env.NEXT_PUBLIC_SURVEYJS_LICENSE || ""

// Default survey configuration
export const DEFAULT_SURVEY_CONFIG = {
  showProgressBar: "top" as const,
  showQuestionNumbers: "on" as const,
  completedHtml: "<h4>Thank you for completing the questionnaire!</h4><p>Your responses have been saved.</p>",
  requiredText: "*",
  showCompletedPage: false, // We'll handle completion in our modal
}

// Default creator configuration
export const DEFAULT_CREATOR_CONFIG = {
  showLogicTab: true,
  showJSONEditorTab: true,
  showTranslationTab: false,
  showEmbeddedSurveyTab: false,
  showDesignerTab: true,
  showPreviewTab: true,
  showThemeTab: false,
}

// Week number to display labels
export const WEEK_LABELS = {
  1: "Week 1",
  2: "Week 2",
  3: "Week 3",
  4: "Week 4",
  5: "Week 5",
} as const

export type WeekNumber = 1 | 2 | 3 | 4 | 5

// Questionnaire status types
export const QUESTIONNAIRE_STATUS = {
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
} as const

export type QuestionnaireStatus = typeof QUESTIONNAIRE_STATUS[keyof typeof QUESTIONNAIRE_STATUS]
