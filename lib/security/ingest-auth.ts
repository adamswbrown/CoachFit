/**
 * Authentication for HealthKit data ingestion endpoints
 *
 * Requires a valid pairing token that links a client to their coach.
 * This replaces the previous unauthenticated endpoints.
 */

import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "./rate-limit"
import { addCorsHeaders, createCorsPreflightResponse } from "./cors"

export interface IngestAuthResult {
  success: true
  clientId: string
  coachId: string
}

export interface IngestAuthError {
  success: false
  error: string
  status: number
}

/**
 * Validate ingest request authentication
 *
 * Checks:
 * 1. HealthKit feature is enabled in system settings
 * 2. Valid pairing token is provided
 * 3. Client exists and is linked to coach
 * 4. Rate limiting
 */
export async function validateIngestAuth(
  req: NextRequest,
  clientId: string
): Promise<IngestAuthResult | IngestAuthError> {
  // Check if HealthKit is enabled in system settings
  const settings = await db.systemSettings.findFirst()

  if (!settings?.healthkitEnabled) {
    return {
      success: false,
      error: "HealthKit integration is disabled",
      status: 503,
    }
  }

  // Get pairing token from header or body
  const pairingToken = req.headers.get("X-Pairing-Token")

  if (!pairingToken) {
    return {
      success: false,
      error: "Missing pairing token. Use X-Pairing-Token header.",
      status: 401,
    }
  }

  // Check rate limit based on client ID
  const rateLimitResult = checkRateLimit(`ingest:${clientId}`, RATE_LIMITS.ingest)

  if (!rateLimitResult.success) {
    return {
      success: false,
      error: "Rate limit exceeded. Please try again later.",
      status: 429,
    }
  }

  // Validate pairing token
  // The token should be the pairing code that was used to establish the relationship
  const pairingCode = await db.pairingCode.findFirst({
    where: {
      clientId: clientId,
      usedAt: { not: null }, // Must be a used (validated) pairing code
    },
    select: {
      coachId: true,
      clientId: true,
      code: true,
    },
    orderBy: {
      usedAt: "desc", // Most recent pairing
    },
  })

  if (!pairingCode) {
    return {
      success: false,
      error: "Invalid or expired pairing. Please re-pair with your coach.",
      status: 401,
    }
  }

  // Verify the token matches the pairing code
  if (pairingCode.code !== pairingToken.toUpperCase()) {
    return {
      success: false,
      error: "Invalid pairing token",
      status: 401,
    }
  }

  // Verify client exists
  const client = await db.user.findUnique({
    where: { id: clientId },
    select: { id: true },
  })

  if (!client) {
    return {
      success: false,
      error: "Client not found",
      status: 404,
    }
  }

  return {
    success: true,
    clientId: pairingCode.clientId!,
    coachId: pairingCode.coachId,
  }
}

/**
 * Create an error response for ingest endpoints
 */
export function createIngestErrorResponse(
  error: IngestAuthError,
  origin: string | null
): NextResponse {
  const response = NextResponse.json(
    { error: error.error },
    { status: error.status }
  )

  return addCorsHeaders(response, origin, { allowMobileOrigin: true })
}

/**
 * Create a success response for ingest endpoints
 */
export function createIngestSuccessResponse(
  data: object,
  origin: string | null,
  status = 200
): NextResponse {
  const response = NextResponse.json(data, { status })
  return addCorsHeaders(response, origin, { allowMobileOrigin: true })
}

/**
 * Handle OPTIONS preflight for ingest endpoints
 */
export function handleIngestPreflight(origin: string | null): NextResponse {
  return createCorsPreflightResponse(origin, {
    allowMobileOrigin: true,
    headers: ["Content-Type", "X-Pairing-Token"],
  })
}

/**
 * Check if HealthKit is enabled (for use in other parts of the app)
 */
export async function isHealthKitEnabled(): Promise<boolean> {
  const settings = await db.systemSettings.findFirst()
  return settings?.healthkitEnabled ?? false
}
