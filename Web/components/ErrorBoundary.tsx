"use client"

import React from "react"

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Ignore browser extension errors
    if (
      error.message?.includes("tab.id") ||
      error.message?.includes("webkit-masked-url") ||
      error.stack?.includes("webkit-masked-url") ||
      error.stack?.includes("chrome-extension") ||
      error.stack?.includes("moz-extension") ||
      error.stack?.includes("safari-extension") ||
      error.message?.includes("Extension context invalidated")
    ) {
      return { hasError: false, error: null }
    }
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error but ignore browser extension errors
    if (
      error.message?.includes("tab.id") ||
      error.message?.includes("webkit-masked-url") ||
      error.stack?.includes("webkit-masked-url") ||
      error.stack?.includes("chrome-extension") ||
      error.stack?.includes("moz-extension") ||
      error.stack?.includes("safari-extension") ||
      error.message?.includes("Extension context invalidated")
    ) {
      console.warn("Ignoring browser extension error:", error.message)
      // Reset error state for extension errors
      this.setState({ hasError: false, error: null })
      return
    }

    console.error("ErrorBoundary caught an error:", error, errorInfo)
  }

  handleError = (event: ErrorEvent) => {
    if (
      event.message?.includes("tab.id") ||
      event.filename?.includes("webkit-masked-url") ||
      event.message?.includes("webkit-masked-url") ||
      event.filename?.includes("chrome-extension") ||
      event.filename?.includes("moz-extension") ||
      event.filename?.includes("safari-extension") ||
      event.message?.includes("Extension context invalidated")
    ) {
      console.warn("Ignoring browser extension error:", event.message)
      event.preventDefault()
      event.stopPropagation()
      return false
    }
  }

  handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason?.message || String(event.reason || "")
    const stack = event.reason?.stack || ""
    if (
      reason.includes("tab.id") ||
      reason.includes("webkit-masked-url") ||
      stack.includes("webkit-masked-url") ||
      reason.includes("Extension context invalidated")
    ) {
      console.warn("Ignoring browser extension promise rejection:", reason)
      event.preventDefault()
      event.stopImmediatePropagation()
      return false
    }
  }

  componentDidMount() {
    // Add global error handler for browser extension errors
    window.addEventListener("error", this.handleError, true)
    window.addEventListener("unhandledrejection", this.handleUnhandledRejection, true)
  }

  componentWillUnmount() {
    // Clean up event listeners
    window.removeEventListener("error", this.handleError, true)
    window.removeEventListener("unhandledrejection", this.handleUnhandledRejection, true)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Don't show error UI for browser extension errors
      if (
        this.state.error.message?.includes("tab.id") ||
        this.state.error.message?.includes("webkit-masked-url") ||
        this.state.error.stack?.includes("webkit-masked-url") ||
        this.state.error.stack?.includes("chrome-extension") ||
        this.state.error.stack?.includes("moz-extension") ||
        this.state.error.stack?.includes("safari-extension") ||
        this.state.error.message?.includes("Extension context invalidated")
      ) {
        return this.props.children
      }

      // Show custom fallback or default error UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="bg-white rounded-lg shadow p-8 max-w-md w-full">
            <h1 className="text-2xl font-bold mb-4 text-red-600">
              Something went wrong
            </h1>
            <p className="text-gray-600 mb-4">
              {this.state.error.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.reload()
              }}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
