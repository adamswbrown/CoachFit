import { createHmac, timingSafeEqual } from "crypto"

/**
 * Revolut Merchant API client.
 *
 * SECURITY: REVOLUT_MERCHANT_API_KEY must NEVER be used in client-side code.
 * This module is server-only — only import from API routes or server-side lib files.
 */

export const REVOLUT_API_URL =
  process.env.REVOLUT_API_URL ?? "https://sandbox-merchant.revolut.com/api/1.0"

export const REVOLUT_ORDER_STATUSES = {
  PENDING: "PENDING",
  PROCESSING: "PROCESSING",
  AUTHORISED: "AUTHORISED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  FAILED: "FAILED",
} as const

export type RevolutOrderStatus =
  (typeof REVOLUT_ORDER_STATUSES)[keyof typeof REVOLUT_ORDER_STATUSES]

export interface RevolutOrder {
  id: string
  token: string
  type: string
  state: RevolutOrderStatus
  created_date: string
  updated_date: string
  order_amount: {
    value: number
    currency: string
  }
  checkout_url?: string
  description?: string
  metadata?: Record<string, string>
}

export interface CreateRevolutOrderParams {
  /** Amount in minor units (pence). £10.00 = 1000 */
  amount: number
  currency: string
  description: string
  metadata: Record<string, string>
}

export interface CreateRevolutOrderResult {
  orderId: string
  checkoutUrl: string
}

/**
 * Create a Revolut order and return the order ID and checkout URL.
 * Amount must be in minor units (pence): £10.00 → 1000.
 */
export async function createRevolutOrder(
  params: CreateRevolutOrderParams
): Promise<CreateRevolutOrderResult> {
  const apiKey = process.env.REVOLUT_MERCHANT_API_KEY
  if (!apiKey) {
    throw new Error("REVOLUT_MERCHANT_API_KEY is not configured")
  }

  const response = await fetch(`${REVOLUT_API_URL}/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Revolut-Api-Version": "2024-09-01",
    },
    body: JSON.stringify({
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      metadata: params.metadata,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `Revolut API error ${response.status}: ${errorBody}`
    )
  }

  const order = (await response.json()) as RevolutOrder

  if (!order.checkout_url) {
    throw new Error("Revolut order created but no checkout_url returned")
  }

  return {
    orderId: order.id,
    checkoutUrl: order.checkout_url,
  }
}

/**
 * Fetch a Revolut order by its ID to check current state.
 */
export async function getRevolutOrder(orderId: string): Promise<RevolutOrder> {
  const apiKey = process.env.REVOLUT_MERCHANT_API_KEY
  if (!apiKey) {
    throw new Error("REVOLUT_MERCHANT_API_KEY is not configured")
  }

  const response = await fetch(`${REVOLUT_API_URL}/orders/${orderId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Revolut-Api-Version": "2024-09-01",
    },
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(
      `Revolut API error ${response.status}: ${errorBody}`
    )
  }

  return (await response.json()) as RevolutOrder
}

/**
 * Verify a Revolut webhook HMAC SHA-256 signature.
 * The signature header contains the raw hex digest of HMAC-SHA256(payload, secret).
 * Uses crypto.timingSafeEqual to prevent timing attacks.
 *
 * @param payload   Raw request body as a string (before JSON.parse)
 * @param signatureHeader  Value of the Revolut-Signature header
 * @returns true if valid, false otherwise
 */
export function verifyRevolutWebhook(
  payload: string,
  signatureHeader: string
): boolean {
  const secret = process.env.REVOLUT_WEBHOOK_SECRET
  if (!secret) {
    console.error("[Revolut] REVOLUT_WEBHOOK_SECRET is not configured")
    return false
  }

  try {
    const expected = createHmac("sha256", secret)
      .update(payload, "utf8")
      .digest("hex")

    const expectedBuf = Buffer.from(expected, "utf8")
    const receivedBuf = Buffer.from(signatureHeader, "utf8")

    // Lengths must match for timingSafeEqual — if they differ the sig is invalid
    if (expectedBuf.length !== receivedBuf.length) {
      return false
    }

    return timingSafeEqual(expectedBuf, receivedBuf)
  } catch {
    return false
  }
}
