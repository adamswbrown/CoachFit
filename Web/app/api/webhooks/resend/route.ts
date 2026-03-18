import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import { db } from "@/lib/db"

// Resend webhook event types we care about
type ResendEmailEventType =
  | "email.sent"
  | "email.delivered"
  | "email.bounced"
  | "email.failed"
  | "email.complained"
  | "email.delivery_delayed"
  | "email.opened"
  | "email.clicked"

interface ResendWebhookPayload {
  type: ResendEmailEventType
  created_at: string
  data: {
    email_id: string
    from: string
    to: string[]
    subject: string
    created_at: string
    // Event-specific fields
    bounce?: { message: string; type: string; subType: string }
    failed?: { reason: string }
    click?: { ipAddress: string; link: string; timestamp: string; userAgent: string }
    suppressed?: { message: string; type: string }
  }
}

// Map Resend event types to our status strings
function eventTypeToStatus(eventType: string): string {
  const map: Record<string, string> = {
    "email.sent": "sent",
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.failed": "failed",
    "email.complained": "complained",
    "email.delivery_delayed": "delivery_delayed",
    "email.opened": "opened",
    "email.clicked": "clicked",
  }
  return map[eventType] || eventType
}

// Extract event-specific data for storage
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractEventData(payload: ResendWebhookPayload): any | null {
  const { type, data } = payload

  if (type === "email.bounced" && data.bounce) {
    return { bounce: data.bounce }
  }
  if (type === "email.failed" && data.failed) {
    return { failed: data.failed }
  }
  if (type === "email.clicked" && data.click) {
    return { click: data.click }
  }
  if (type === "email.complained" && data.suppressed) {
    return { suppressed: data.suppressed }
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
    if (!webhookSecret) {
      console.error("[Resend Webhook] RESEND_WEBHOOK_SECRET not configured")
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      )
    }

    // Read the raw body for signature verification
    const body = await req.text()

    // Extract Svix headers
    const svixId = req.headers.get("svix-id")
    const svixTimestamp = req.headers.get("svix-timestamp")
    const svixSignature = req.headers.get("svix-signature")

    if (!svixId || !svixTimestamp || !svixSignature) {
      console.warn("[Resend Webhook] Missing Svix headers")
      return NextResponse.json(
        { error: "Missing webhook signature headers" },
        { status: 401 }
      )
    }

    // Verify the webhook signature
    const wh = new Webhook(webhookSecret)
    let payload: ResendWebhookPayload

    try {
      payload = wh.verify(body, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as ResendWebhookPayload
    } catch (verifyError) {
      console.warn("[Resend Webhook] Signature verification failed:", verifyError)
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 }
      )
    }

    const { type, data, created_at } = payload
    const status = eventTypeToStatus(type)
    const resendEmailId = data.email_id
    const to = Array.isArray(data.to) ? data.to[0] : data.to
    const subject = data.subject || null
    const eventData = extractEventData(payload)
    const occurredAt = new Date(created_at)

    // Try to match this email to a pending invite by recipient address
    let coachInviteId: string | null = null
    let cohortInviteId: string | null = null

    // First check if we already have an EmailEvent for this resendEmailId with invite links
    const existingEvent = await db.emailEvent.findFirst({
      where: { resendEmailId },
      select: { coachInviteId: true, cohortInviteId: true },
    })

    if (existingEvent) {
      // Reuse the invite links from the initial "sent" event
      coachInviteId = existingEvent.coachInviteId
      cohortInviteId = existingEvent.cohortInviteId
    } else if (to) {
      // Fallback: try to match by email address (for events that arrive before our initial record)
      const coachInvite = await db.coachInvite.findFirst({
        where: { email: to },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      })
      if (coachInvite) {
        coachInviteId = coachInvite.id
      }

      const cohortInvite = await db.cohortInvite.findFirst({
        where: { email: to },
        select: { id: true },
        orderBy: { createdAt: "desc" },
      })
      if (cohortInvite) {
        cohortInviteId = cohortInvite.id
      }
    }

    // Create the email event record
    await db.emailEvent.create({
      data: {
        resendEmailId,
        to: to || "",
        subject,
        status,
        eventData: eventData || undefined,
        occurredAt,
        coachInviteId,
        cohortInviteId,
      },
    })

    console.log(`[Resend Webhook] Recorded ${type} for ${resendEmailId} (to: ${to})`)

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (error) {
    console.error("[Resend Webhook] Error processing webhook:", error)
    // Return 200 to prevent Resend from retrying on application errors
    // (Resend retries on non-2xx, which could cause infinite loops for bad data)
    return NextResponse.json({ received: true, error: "Processing error" }, { status: 200 })
  }
}
