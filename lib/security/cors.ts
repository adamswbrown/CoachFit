/**
 * CORS configuration for API endpoints
 *
 * Replaces wildcard (*) CORS with controlled origin validation
 */

import { NextResponse } from "next/server"

// Allowed origins for mobile app and web clients
// In production, these should be configured via environment variables
const ALLOWED_ORIGINS = [
  // Local development
  "http://localhost:3000",
  "http://127.0.0.1:3000",

  // iOS app custom URL schemes (if applicable)
  // "coachfit://",

  // Production domains (add via ALLOWED_CORS_ORIGINS env var)
]

/**
 * Get allowed origins including any from environment
 */
export function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_CORS_ORIGINS
  if (envOrigins) {
    return [...ALLOWED_ORIGINS, ...envOrigins.split(",").map((o) => o.trim())]
  }
  return ALLOWED_ORIGINS
}

/**
 * Validate if an origin is allowed
 */
export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false

  const allowed = getAllowedOrigins()

  // Check exact match
  if (allowed.includes(origin)) return true

  // Check for iOS app bundle identifier scheme (coachfit://...)
  // Mobile apps don't send Origin headers the same way browsers do
  // but we can allow specific patterns if needed

  return false
}

/**
 * Add CORS headers to a response with proper origin validation
 *
 * For mobile app endpoints that need to accept requests from iOS apps,
 * we use a more permissive policy but still require authentication
 */
export function addCorsHeaders(
  response: NextResponse,
  origin: string | null,
  options: {
    /** Allow credentials (cookies, authorization headers) */
    credentials?: boolean
    /** Allowed HTTP methods */
    methods?: string[]
    /** Allowed request headers */
    headers?: string[]
    /** Max age for preflight cache (seconds) */
    maxAge?: number
    /** For mobile endpoints - uses * but requires separate auth */
    allowMobileOrigin?: boolean
  } = {}
): NextResponse {
  const {
    credentials = false,
    methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    headers = ["Content-Type", "Authorization", "X-Pairing-Token"],
    maxAge = 86400,
    allowMobileOrigin = false,
  } = options

  // For mobile app endpoints, we allow all origins but require pairing token auth
  // This is because iOS apps don't send traditional Origin headers
  if (allowMobileOrigin) {
    response.headers.set("Access-Control-Allow-Origin", "*")
  } else if (origin && isOriginAllowed(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin)
    if (credentials) {
      response.headers.set("Access-Control-Allow-Credentials", "true")
    }
  }
  // If origin not allowed, don't set Access-Control-Allow-Origin

  response.headers.set("Access-Control-Allow-Methods", methods.join(", "))
  response.headers.set("Access-Control-Allow-Headers", headers.join(", "))
  response.headers.set("Access-Control-Max-Age", String(maxAge))

  return response
}

/**
 * Create a CORS preflight response
 */
export function createCorsPreflightResponse(
  origin: string | null,
  options: Parameters<typeof addCorsHeaders>[2] = {}
): NextResponse {
  const response = new NextResponse(null, { status: 204 })
  return addCorsHeaders(response, origin, options)
}

/**
 * CORS error response
 */
export function corsErrorResponse(): NextResponse {
  return NextResponse.json(
    { error: "Origin not allowed" },
    { status: 403 }
  )
}
