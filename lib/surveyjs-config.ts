import { Survey, StylesManager } from "survey-core"

/**
 * Initialize SurveyJS with custom theme and configuration
 */
export function initializeSurveyJS() {
  // Apply default Tailwind-compatible theme
  StylesManager.applyTheme("default")
}

/**
 * Create a survey instance with auto-save configuration
 */
export function createSurveyModel(jsonSchema: any) {
  const survey = new Survey(jsonSchema)
  
  // Enable question numbers
  survey.showQuestionNumbers = "on"
  
  // Show page numbers in progress bar
  survey.showProgressBar = "top"
  
  // Allow partial saves
  survey.completedHtmlTemplate = "<h3>Thank you for completing this questionnaire!</h3>"
  
  return survey
}

/**
 * Debounce utility for auto-save (500ms default)
 */
export function createAutoSaveDebounce(callback: () => void, delayMs: number = 500) {
  let timeoutId: NodeJS.Timeout | null = null
  
  return () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    
    timeoutId = setTimeout(() => {
      callback()
      timeoutId = null
    }, delayMs)
  }
}

/**
 * Create a 5-second auto-save interval
 * Call this once to start, returns cleanup function
 */
export function createAutoSaveInterval(callback: () => void, intervalMs: number = 5000) {
  const intervalId = setInterval(callback, intervalMs)
  
  return () => {
    clearInterval(intervalId)
  }
}

/**
 * Format last saved timestamp
 */
export function formatLastSavedTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  
  if (diffSecs < 60) {
    return "Just now"
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`
  } else {
    return date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }
}
