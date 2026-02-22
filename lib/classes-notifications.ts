import { sendTransactionalEmail } from "@/lib/email"
import { logAuditAction, type AuditActor } from "@/lib/audit-log"

export type ClassNotificationKind = "booked" | "waitlisted" | "cancelled" | "waitlist_promoted"

export type ClassNotificationRecipient = {
  id: string
  email: string
  name?: string | null
  isTestUser?: boolean
}

export type ClassNotificationInput = {
  actor: AuditActor
  recipient: ClassNotificationRecipient
  kind: ClassNotificationKind
  className: string
  startsAt: Date
  locationLabel?: string | null
  timezone?: string | null
  waitlistPosition?: number | null
}

function formatClassDate(startsAt: Date, timezone: string | null | undefined): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: timezone || "Europe/London",
    }).format(startsAt)
  } catch {
    return startsAt.toISOString()
  }
}

function getSubject(kind: ClassNotificationKind, className: string): string {
  if (kind === "booked") return `Booking confirmed: ${className}`
  if (kind === "waitlisted") return `Added to waitlist: ${className}`
  if (kind === "waitlist_promoted") return `Spot available: You are now booked for ${className}`
  return `Booking cancelled: ${className}`
}

function getMessage(kind: ClassNotificationKind): string {
  if (kind === "booked") return "Your class booking is confirmed."
  if (kind === "waitlisted") return "You have been added to the waitlist."
  if (kind === "waitlist_promoted") return "A spot opened up and your booking is now confirmed."
  return "Your class booking has been cancelled."
}

export async function sendClassNotification(input: ClassNotificationInput): Promise<void> {
  const when = formatClassDate(input.startsAt, input.timezone)
  const subject = getSubject(input.kind, input.className)
  const message = getMessage(input.kind)
  const location = input.locationLabel ? `<p><strong>Location:</strong> ${input.locationLabel}</p>` : ""
  const waitlistLine =
    input.kind === "waitlisted" && input.waitlistPosition
      ? `<p><strong>Waitlist position:</strong> ${input.waitlistPosition}</p>`
      : ""

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
      <h2 style="color: #111827;">${subject}</h2>
      <p>Hi ${input.recipient.name || input.recipient.email},</p>
      <p>${message}</p>
      <p><strong>Class:</strong> ${input.className}</p>
      <p><strong>Time:</strong> ${when}</p>
      ${location}
      ${waitlistLine}
      <p style="margin-top: 16px; color: #4b5563;">CoachFit</p>
    </div>
  `

  const textLines = [
    subject,
    `Hi ${input.recipient.name || input.recipient.email},`,
    message,
    `Class: ${input.className}`,
    `Time: ${when}`,
  ]

  if (input.locationLabel) {
    textLines.push(`Location: ${input.locationLabel}`)
  }

  if (input.kind === "waitlisted" && input.waitlistPosition) {
    textLines.push(`Waitlist position: ${input.waitlistPosition}`)
  }

  await sendTransactionalEmail({
    to: input.recipient.email,
    subject,
    html,
    text: textLines.join("\n"),
    isTestUser: input.recipient.isTestUser,
  })

  await logAuditAction({
    actor: input.actor,
    actionType: "CLASS_NOTIFICATION_SENT",
    targetType: "class_notification",
    targetId: input.recipient.id,
    details: {
      kind: input.kind,
      className: input.className,
      startsAt: input.startsAt.toISOString(),
      recipientEmail: input.recipient.email,
    },
  })
}
