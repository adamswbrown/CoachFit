"use client"

import { useState, useEffect, useCallback } from "react"

// Get VAPID public key from environment
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

export interface NotificationPreferences {
  dailyReminderEnabled: boolean
  dailyReminderTime: "morning" | "afternoon" | "evening"
  weeklyReminderEnabled: boolean
  missedEntryReminder: boolean
  missedQuestionnaireReminder: boolean
  coachNoteNotification: boolean
  emailNotifications: boolean
  pushNotifications: boolean
}

export interface UseNotificationsReturn {
  // Permission state
  permissionState: NotificationPermission | "unsupported"
  isPushSupported: boolean
  isSubscribed: boolean

  // Preferences
  preferences: NotificationPreferences | null
  preferencesLoading: boolean
  preferencesError: string | null

  // Actions
  requestPermission: () => Promise<boolean>
  subscribeToPush: () => Promise<boolean>
  unsubscribeFromPush: () => Promise<boolean>
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<boolean>
  refreshPreferences: () => Promise<void>
}

const defaultPreferences: NotificationPreferences = {
  dailyReminderEnabled: true,
  dailyReminderTime: "morning",
  weeklyReminderEnabled: true,
  missedEntryReminder: true,
  missedQuestionnaireReminder: true,
  coachNoteNotification: true,
  emailNotifications: true,
  pushNotifications: true,
}

export function useNotifications(): UseNotificationsReturn {
  const [permissionState, setPermissionState] = useState<NotificationPermission | "unsupported">("default")
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)
  const [preferencesLoading, setPreferencesLoading] = useState(true)
  const [preferencesError, setPreferencesError] = useState<string | null>(null)

  // Check if push notifications are supported
  const isPushSupported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    !!VAPID_PUBLIC_KEY

  // Check current permission state and subscription
  useEffect(() => {
    if (typeof window === "undefined") return

    // Check notification permission
    if ("Notification" in window) {
      setPermissionState(Notification.permission)
    } else {
      setPermissionState("unsupported")
    }

    // Check if already subscribed
    if (isPushSupported) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.pushManager.getSubscription().then((subscription) => {
          setIsSubscribed(!!subscription)
        })
      })
    }
  }, [isPushSupported])

  // Load preferences from API
  const refreshPreferences = useCallback(async () => {
    setPreferencesLoading(true)
    setPreferencesError(null)

    try {
      const response = await fetch("/api/notifications/preferences")
      if (!response.ok) {
        throw new Error("Failed to load preferences")
      }

      const data = await response.json()
      setPreferences(data.preferences)
    } catch (error) {
      console.error("Error loading notification preferences:", error)
      setPreferencesError("Failed to load notification preferences")
      setPreferences(defaultPreferences)
    } finally {
      setPreferencesLoading(false)
    }
  }, [])

  // Load preferences on mount
  useEffect(() => {
    refreshPreferences()
  }, [refreshPreferences])

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) {
      console.warn("Notifications not supported")
      return false
    }

    try {
      const permission = await Notification.requestPermission()
      setPermissionState(permission)
      return permission === "granted"
    } catch (error) {
      console.error("Error requesting notification permission:", error)
      return false
    }
  }, [])

  // Convert base64 URL to ArrayBuffer for VAPID key
  const urlBase64ToUint8Array = (base64String: string): ArrayBuffer => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray.buffer
  }

  // Subscribe to push notifications
  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported || !VAPID_PUBLIC_KEY) {
      console.warn("Push notifications not supported or VAPID key not configured")
      return false
    }

    // First request permission if not granted
    if (permissionState !== "granted") {
      const granted = await requestPermission()
      if (!granted) {
        return false
      }
    }

    try {
      const registration = await navigator.serviceWorker.ready
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY)

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      // Send subscription to server
      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("p256dh")!))),
            auth: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey("auth")!))),
          },
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save subscription")
      }

      setIsSubscribed(true)
      return true
    } catch (error) {
      console.error("Error subscribing to push:", error)
      return false
    }
  }, [isPushSupported, permissionState, requestPermission])

  // Unsubscribe from push notifications
  const unsubscribeFromPush = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported) return false

    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        // Unsubscribe locally
        await subscription.unsubscribe()

        // Remove from server
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
      }

      setIsSubscribed(false)
      return true
    } catch (error) {
      console.error("Error unsubscribing from push:", error)
      return false
    }
  }, [isPushSupported])

  // Update preferences
  const updatePreferences = useCallback(
    async (updates: Partial<NotificationPreferences>): Promise<boolean> => {
      try {
        const response = await fetch("/api/notifications/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        })

        if (!response.ok) {
          throw new Error("Failed to update preferences")
        }

        const data = await response.json()
        setPreferences(data.preferences)

        // If push notifications are being disabled, unsubscribe
        if (updates.pushNotifications === false && isSubscribed) {
          await unsubscribeFromPush()
        }

        return true
      } catch (error) {
        console.error("Error updating notification preferences:", error)
        return false
      }
    },
    [isSubscribed, unsubscribeFromPush]
  )

  return {
    permissionState,
    isPushSupported,
    isSubscribed,
    preferences,
    preferencesLoading,
    preferencesError,
    requestPermission,
    subscribeToPush,
    unsubscribeFromPush,
    updatePreferences,
    refreshPreferences,
  }
}
