import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logAuditAction } from "@/lib/audit-log"
import { verifyRevolutWebhook } from "@/lib/revolut"
import { processSubmission } from "@/lib/credits"
import { CreditSubmissionStatus } from "@prisma/client"

// Revolut retries non-200 responses 3x at 10-minute intervals.
// Always return 200 after signature verification — even for errors we can't recover from.
// This prevents infinite retry loops on legitimate but unprocessable events.

export async function POST(req: NextRequest) {
  // Step 1: Read raw body for HMAC verification BEFORE any JSON parsing
  const rawBody = await req.text()

  const signatureHeader = req.headers.get("Revolut-Signature") ?? ""

  // Step 2: Verify HMAC SHA-256 signature FIRST — reject unverified requests immediately
  if (!signatureHeader || !verifyRevolutWebhook(rawBody, signatureHeader)) {
    console.warn("[Revolut webhook] Invalid or missing signature")
    // Return 400 here (not 200) — we want Revolut to know the request was bad,
    // but we should not process any DB operations with unverified payloads.
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  // Step 3: Parse the verified payload
  let event: any
  try {
    event = JSON.parse(rawBody)
  } catch {
    console.error("[Revolut webhook] Failed to parse JSON body")
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const eventType: string = event?.event ?? event?.type ?? ""
  const orderId: string = event?.order_id ?? event?.data?.order?.id ?? ""

  console.log(`[Revolut webhook] Received event: ${eventType}, orderId: ${orderId}`)

  try {
    if (eventType === "ORDER_COMPLETED") {
      await handleOrderCompleted(orderId, event)
    } else if (
      eventType === "ORDER_PAYMENT_DECLINED" ||
      eventType === "ORDER_CANCELLED"
    ) {
      await handleOrderFailed(orderId, eventType)
    } else {
      // Unhandled event type — log and acknowledge
      console.log(`[Revolut webhook] Unhandled event type: ${eventType}`)
    }
  } catch (error) {
    // Log but still return 200 to prevent Revolut retries on transient errors
    console.error(`[Revolut webhook] Error processing event ${eventType}:`, error)
  }

  // Always return 200 after signature verification to acknowledge receipt
  return NextResponse.json({ received: true }, { status: 200 })
}

async function handleOrderCompleted(orderId: string, event: any): Promise<void> {
  if (!orderId) {
    console.warn("[Revolut webhook] ORDER_COMPLETED missing orderId")
    return
  }

  const submission = await db.creditSubmission.findUnique({
    where: { revolutOrderId: orderId },
    select: { id: true, status: true, clientId: true, creditProductId: true },
  })

  if (!submission) {
    console.warn(`[Revolut webhook] No submission found for orderId: ${orderId}`)
    return
  }

  // Idempotent: skip if already processed
  if (submission.status !== CreditSubmissionStatus.PENDING) {
    console.log(
      `[Revolut webhook] Submission ${submission.id} already ${submission.status} — skipping`
    )
    return
  }

  // Determine payment method from event if present
  const paymentMethod: string =
    event?.data?.payment_method ?? event?.payment_method ?? "revolut_checkout"

  // Approve the submission and top up credits — paidAt/paymentMethod set atomically
  await processSubmission(submission.id, "APPROVE", "SYSTEM", {
    paidAt: new Date(),
    paymentMethod,
  })

  // Audit log with a system actor
  await logAuditAction({
    actor: { id: submission.clientId },
    actionType: "CREDIT_SUBMISSION_AUTO_APPROVE",
    targetType: "credit_submission",
    targetId: submission.id,
    details: {
      orderId,
      paymentMethod,
      eventType: "ORDER_COMPLETED",
      trigger: "revolut_webhook",
    },
  })

  console.log(
    `[Revolut webhook] Approved submission ${submission.id} for orderId ${orderId}`
  )
}

async function handleOrderFailed(orderId: string, eventType: string): Promise<void> {
  if (!orderId) {
    console.warn(`[Revolut webhook] ${eventType} missing orderId`)
    return
  }

  const submission = await db.creditSubmission.findUnique({
    where: { revolutOrderId: orderId },
    select: { id: true, status: true, clientId: true },
  })

  if (!submission) {
    console.warn(`[Revolut webhook] No submission found for orderId: ${orderId}`)
    return
  }

  // Idempotent: skip if already processed
  if (submission.status !== CreditSubmissionStatus.PENDING) {
    console.log(
      `[Revolut webhook] Submission ${submission.id} already ${submission.status} — skipping`
    )
    return
  }

  await db.creditSubmission.update({
    where: { id: submission.id },
    data: {
      status: CreditSubmissionStatus.REJECTED,
      reviewedAt: new Date(),
    },
  })

  await logAuditAction({
    actor: { id: submission.clientId },
    actionType: "CREDIT_SUBMISSION_AUTO_REJECT",
    targetType: "credit_submission",
    targetId: submission.id,
    details: {
      orderId,
      eventType,
      trigger: "revolut_webhook",
    },
  })

  console.log(
    `[Revolut webhook] Rejected submission ${submission.id} for orderId ${orderId} (${eventType})`
  )
}
