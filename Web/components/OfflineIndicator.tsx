"use client"

import { usePWA } from "./PWAProvider"

export function OfflineIndicator() {
  const { isOnline, pendingOfflineActions, syncOfflineActions } = usePWA()

  if (isOnline && pendingOfflineActions === 0) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 safe-area-inset-top">
      {!isOnline && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium">
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
              />
            </svg>
            <span>You're offline - changes will sync when connected</span>
          </span>
        </div>
      )}

      {isOnline && pendingOfflineActions > 0 && (
        <div className="bg-blue-500 text-white text-center py-2 px-4 text-sm font-medium">
          <span className="inline-flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span>
              Syncing {pendingOfflineActions} offline {pendingOfflineActions === 1 ? "action" : "actions"}...
            </span>
            <button
              onClick={syncOfflineActions}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </span>
        </div>
      )}
    </div>
  )
}
