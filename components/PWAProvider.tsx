"use client"

import { useEffect, useState, createContext, useContext, useCallback } from "react"

interface PWAContextType {
  isInstallable: boolean
  isInstalled: boolean
  isOnline: boolean
  promptInstall: () => Promise<void>
  pendingOfflineEntries: number
}

const PWAContext = createContext<PWAContextType>({
  isInstallable: false,
  isInstalled: false,
  isOnline: true,
  promptInstall: async () => {},
  pendingOfflineEntries: 0,
})

export function usePWA() {
  return useContext(PWAContext)
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [isInstallable, setIsInstallable] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [pendingOfflineEntries, setPendingOfflineEntries] = useState(0)

  // Register service worker
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("[PWA] Service worker registered:", registration.scope)

          // Check for updates periodically
          setInterval(() => {
            registration.update()
          }, 60 * 60 * 1000) // Check every hour
        })
        .catch((error) => {
          console.error("[PWA] Service worker registration failed:", error)
        })

      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "OFFLINE_SYNC_COMPLETE") {
          console.log("[PWA] Offline sync complete:", event.data)
          setPendingOfflineEntries(event.data.failed)

          // Show notification if entries were synced
          if (event.data.synced > 0) {
            // Could show a toast notification here
          }
        }
      })
    }
  }, [])

  // Handle beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsInstallable(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [])

  // Check if app is already installed
  useEffect(() => {
    // Check display-mode for standalone
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    // Check iOS Safari standalone mode
    const isIOSStandalone = ("standalone" in window.navigator) && (window.navigator as Navigator & { standalone: boolean }).standalone

    setIsInstalled(isStandalone || isIOSStandalone)

    // Listen for display mode changes
    const mediaQuery = window.matchMedia("(display-mode: standalone)")
    const handleChange = (e: MediaQueryListEvent) => {
      setIsInstalled(e.matches)
    }
    mediaQuery.addEventListener("change", handleChange)

    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  // Handle online/offline status
  useEffect(() => {
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      // Trigger offline sync
      if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: "SYNC_OFFLINE_ENTRIES",
        })
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Check for pending offline entries
  useEffect(() => {
    const checkPendingEntries = async () => {
      try {
        const request = indexedDB.open("coachfit-offline", 1)
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          if (db.objectStoreNames.contains("queue")) {
            const transaction = db.transaction("queue", "readonly")
            const store = transaction.objectStore("queue")
            const countRequest = store.count()
            countRequest.onsuccess = () => {
              setPendingOfflineEntries(countRequest.result)
            }
          }
        }
      } catch {
        // IndexedDB not available
      }
    }

    checkPendingEntries()
    // Check periodically
    const interval = setInterval(checkPendingEntries, 30000)
    return () => clearInterval(interval)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return

    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice

    if (outcome === "accepted") {
      setIsInstalled(true)
    }

    setDeferredPrompt(null)
    setIsInstallable(false)
  }, [deferredPrompt])

  return (
    <PWAContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isOnline,
        promptInstall,
        pendingOfflineEntries,
      }}
    >
      {children}
    </PWAContext.Provider>
  )
}
