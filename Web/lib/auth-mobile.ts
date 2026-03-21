/**
 * Mobile-aware authentication helper.
 *
 * Extends the standard Clerk-based `getSession()` to also accept
 * the `X-Pairing-Token` header used by the iOS app. This allows
 * class booking, credits, and challenges endpoints to serve both
 * web (Clerk session cookie) and mobile (device token) clients
 * without duplicating route logic.
 *
 * Resolution order:
 * 1. Clerk session cookie → standard `getSession()` flow
 * 2. X-Pairing-Token header → PairingCode lookup → User record
 */

import { headers } from "next/headers"
import { getSession, type AuthSession } from "./auth"
import { db } from "./db"
import { Role } from "./types"

/**
 * Get the current session from either Clerk cookies or a mobile device token.
 *
 * Drop-in replacement for `getSession()` in routes that need to support
 * both web and iOS clients.
 */
export async function getSessionWithMobile(): Promise<AuthSession | null> {
  // 1. Try standard Clerk session first (web clients)
  const clerkSession = await getSession()
  if (clerkSession) return clerkSession

  // 2. Fall back to device token (iOS app)
  const headerStore = await headers()
  const deviceToken = headerStore.get("X-Pairing-Token")
  if (!deviceToken) return null

  // Device tokens are 64-char hex strings
  const isDeviceToken =
    deviceToken.length === 64 && /^[a-f0-9]{64}$/i.test(deviceToken)
  if (!isDeviceToken) return null

  // Look up the pairing code by device token
  const pairingCode = await db.pairingCode.findFirst({
    where: {
      deviceToken: deviceToken.toLowerCase(),
      usedAt: { not: null },
    },
    select: {
      clientId: true,
    },
  })

  if (!pairingCode?.clientId) return null

  // Look up the user record
  const user = await db.user.findUnique({
    where: { id: pairingCode.clientId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      roles: true,
      isTestUser: true,
      mustChangePassword: true,
      onboardingComplete: true,
    },
  })

  if (!user) return null

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      image: user.image ?? null,
      roles: (user.roles as Role[]) ?? [Role.CLIENT],
      isTestUser: user.isTestUser ?? false,
      mustChangePassword: user.mustChangePassword ?? false,
      onboardingComplete: user.onboardingComplete ?? false,
    },
  }
}
