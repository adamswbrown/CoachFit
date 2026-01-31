"use client"

import { useState, useEffect } from "react"
import { usePWA } from "./PWAProvider"

export function PWAInstallPrompt() {
  const { isInstallable, isInstalled, promptInstall } = usePWA()
  const [isDismissed, setIsDismissed] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  useEffect(() => {
    // Check if already dismissed in this session
    const dismissed = sessionStorage.getItem("pwa-prompt-dismissed")
    if (dismissed) {
      setIsDismissed(true)
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as Window & { MSStream?: unknown }).MSStream
    setIsIOS(isIOSDevice)
  }, [])

  const handleDismiss = () => {
    setIsDismissed(true)
    sessionStorage.setItem("pwa-prompt-dismissed", "true")
  }

  const handleInstall = async () => {
    if (isIOS) {
      setShowIOSInstructions(true)
    } else {
      await promptInstall()
    }
  }

  // Don't show if already installed or dismissed
  if (isInstalled || isDismissed) {
    return null
  }

  // Only show if installable (Android/Desktop) or on iOS
  if (!isInstallable && !isIOS) {
    return null
  }

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white border-t border-gray-200 shadow-lg safe-area-inset-bottom">
        <div className="flex items-center justify-between max-w-lg mx-auto gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-900 flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                viewBox="0 0 512 512"
                fill="none"
              >
                <circle
                  cx="256"
                  cy="256"
                  r="200"
                  stroke="currentColor"
                  strokeWidth="32"
                />
                <path
                  d="M180 300 L256 140 L332 300"
                  stroke="currentColor"
                  strokeWidth="32"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Install CoachFit</p>
              <p className="text-xs text-gray-500 truncate">Add to home screen for quick access</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDismiss}
              className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800"
              aria-label="Dismiss install prompt"
            >
              Later
            </button>
            <button
              onClick={handleInstall}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800 active:bg-blue-950 transition-colors"
            >
              Install
            </button>
          </div>
        </div>
      </div>

      {/* iOS Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50">
          <div className="w-full max-w-lg bg-white rounded-t-2xl p-6 pb-8 safe-area-inset-bottom animate-slide-up">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Install CoachFit on iOS
              </h3>
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
                aria-label="Close instructions"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-900 font-semibold text-sm">
                  1
                </div>
                <div>
                  <p className="text-gray-900 font-medium">Tap the Share button</p>
                  <p className="text-sm text-gray-500">
                    Find the share icon{" "}
                    <svg className="inline w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M8 12h.01M12 12h.01M16 12h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path d="M9 9l3-3 3 3M12 6v12" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>{" "}
                    at the bottom of Safari
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-900 font-semibold text-sm">
                  2
                </div>
                <div>
                  <p className="text-gray-900 font-medium">Scroll and tap "Add to Home Screen"</p>
                  <p className="text-sm text-gray-500">
                    It may be in the second row of options
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-900 font-semibold text-sm">
                  3
                </div>
                <div>
                  <p className="text-gray-900 font-medium">Tap "Add" to confirm</p>
                  <p className="text-sm text-gray-500">
                    CoachFit will appear on your home screen
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowIOSInstructions(false)}
              className="mt-6 w-full py-3 bg-blue-900 text-white font-medium rounded-xl hover:bg-blue-800 active:bg-blue-950 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  )
}
