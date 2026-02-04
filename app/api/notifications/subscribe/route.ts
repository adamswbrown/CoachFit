/**
 * Push Notification Subscription API
 * POST - Subscribe to push notifications
 * DELETE - Unsubscribe from push notifications
 */

import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

// Validation schema for subscription
const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
})

/**
 * POST /api/notifications/subscribe
 * Subscribe to push notifications
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = subscriptionSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid subscription data", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { endpoint, keys } = parsed.data
    const userAgent = request.headers.get("user-agent") || undefined

    // Upsert subscription (update if exists, create if not)
    const subscription = await db.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: session.user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
        updatedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      },
    })

    // Ensure push notifications are enabled in user preferences
    await db.userPreference.upsert({
      where: { userId: session.user.id },
      update: {
        pushNotifications: true,
      },
      create: {
        userId: session.user.id,
        pushNotifications: true,
      },
    })

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
    })
  } catch (error) {
    console.error("[API] Push subscription error:", error)
    return NextResponse.json(
      { error: "Failed to subscribe to notifications" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/notifications/subscribe
 * Unsubscribe from push notifications
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { endpoint } = body

    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint required" }, { status: 400 })
    }

    // Delete the subscription
    await db.pushSubscription.deleteMany({
      where: {
        userId: session.user.id,
        endpoint,
      },
    })

    // Check if user has any remaining subscriptions
    const remainingSubscriptions = await db.pushSubscription.count({
      where: { userId: session.user.id },
    })

    // If no subscriptions left, disable push notifications in preferences
    if (remainingSubscriptions === 0) {
      await db.userPreference.update({
        where: { userId: session.user.id },
        data: { pushNotifications: false },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[API] Push unsubscribe error:", error)
    return NextResponse.json(
      { error: "Failed to unsubscribe from notifications" },
      { status: 500 }
    )
  }
}
