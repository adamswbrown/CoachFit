"use client"

import { useEffect, useState, createContext, useContext, useCallback } from "react"

interface PWAContextType {
  isInstallable: boolean
  isInstalled: boolean
  isOnline: boolean
  promptInstall: () => Promise<void>
  pendingOfflineActions: number
  syncOfflineActions: () => void
}

const PWAContext = createContext<PWAContextType>({
  isInstallable: false,
  isInstalled: false,
  isOnline: true,
  promptInstall: async () => {},
  pendingOfflineActions: 0,
  syncOfflineActions: () => {},
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
  const [pendingOfflineActions, setPendingOfflineActions] = useState(0)

  // Register service worker
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    const isLocalHost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    const isLocalDevelopment = process.env.NODE_ENV !== "production" || isLocalHost

    if (isLocalDevelopment) {
      void (async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations()
          await Promise.all(registrations.map((registration) => registration.unregister()))

          if ("caches" in window) {
            const keys = await caches.keys()
            await Promise.all(
              keys
                .filter((key) => key.startsWith("coachfit-"))
                .map((key) => caches.delete(key)),
            )
          }

          console.log("[PWA] Disabled service worker caching for local development")
        } catch (error) {
          console.warn("[PWA] Failed to clear local service workers/caches:", error)
        }
      })()
      return
    }

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
        setPendingOfflineActions(event.data.failed)

        // Show notification if actions were synced
        if (event.data.synced > 0) {
          console.log(`[PWA] Successfully synced ${event.data.synced} offline actions`)
        }
      }
    })
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
          type: "SYNC_OFFLINE_ACTIONS",
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

  // Check for pending offline actions
  useEffect(() => {
    const checkPendingActions = async () => {
      try {
        const request = indexedDB.open("coachfit-offline", 2)
        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result
          // Check both stores for backwards compatibility
          const storeName = db.objectStoreNames.contains("actions") ? "actions" : "queue"
          if (db.objectStoreNames.contains(storeName)) {
            const transaction = db.transaction(storeName, "readonly")
            const store = transaction.objectStore(storeName)
            const countRequest = store.count()
            countRequest.onsuccess = () => {
              setPendingOfflineActions(countRequest.result)
            }
          }
        }
      } catch {
        // IndexedDB not available
      }
    }

    checkPendingActions()
    // Check periodically
    const interval = setInterval(checkPendingActions, 30000)
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

  const syncOfflineActions = useCallback(() => {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SYNC_OFFLINE_ACTIONS",
      })
    }
  }, [])

  return (
    <PWAContext.Provider
      value={{
        isInstallable,
        isInstalled,
        isOnline,
        promptInstall,
        pendingOfflineActions,
        syncOfflineActions,
      }}
    >
      {children}
    </PWAContext.Provider>
  )
}
