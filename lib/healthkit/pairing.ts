/**
 * Pairing code utilities for iOS app HealthKit integration.
 * Generates and validates 6-character alphanumeric codes for device pairing.
 */

import { db } from "@/lib/db"

// Characters used for pairing codes (excludes ambiguous characters like 0, O, I, l)
const PAIRING_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const PAIRING_CODE_LENGTH = 6
const PAIRING_CODE_EXPIRY_HOURS = 24

/**
 * Generate a random pairing code
 * @returns 6-character alphanumeric code
 */
export function generatePairingCode(): string {
  let code = ""
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    const randomIndex = Math.floor(Math.random() * PAIRING_CODE_CHARS.length)
    code += PAIRING_CODE_CHARS[randomIndex]
  }
  return code
}

/**
 * Generate expiration time for a pairing code
 * @param hours Number of hours until expiration (default: 24)
 * @returns Expiration Date
 */
export function generateExpirationTime(hours: number = PAIRING_CODE_EXPIRY_HOURS): Date {
  const expiresAt = new Date()
  expiresAt.setHours(expiresAt.getHours() + hours)
  return expiresAt
}

/**
 * Check if a pairing code format is valid
 * @param code The code to validate
 * @returns true if format is valid
 */
export function isValidCodeFormat(code: string): boolean {
  if (!code || code.length !== PAIRING_CODE_LENGTH) {
    return false
  }
  // Check all characters are valid
  return code.split("").every((char) => PAIRING_CODE_CHARS.includes(char.toUpperCase()))
}

/**
 * Create a new pairing code in the database for a specific client
 * @param userId The user (coach or admin) creating the code
 * @param clientId The client this code is for
 * @param isAdmin Whether the user is an admin (bypasses association check)
 * @returns The created pairing code record
 */
export async function createPairingCode(userId: string, clientId: string, isAdmin = false) {
  // Verify client exists and is associated with this coach (or user is admin)
  // Check both direct invitation and cohort membership
  const client = await db.user.findUnique({
    where: { id: clientId },
    include: {
      CohortMembership: {
        include: {
          Cohort: {
            select: { coachId: true }
          }
        }
      }
    }
  })

  if (!client) {
    throw new Error("Client not found")
  }

  // Admins can generate codes for any client
  if (!isAdmin) {
    // Check if client is associated with this coach via invitedByCoachId or cohort membership
    const isAssociated = client.invitedByCoachId === userId || 
      client.CohortMembership.some(m => m.Cohort.coachId === userId)

    if (!isAssociated) {
      throw new Error("Client not associated with this coach")
    }
  }

  // Determine the actual coach ID for the pairing code
  // For admins, use the client's actual coach (invitedByCoachId or first cohort coach)
  // For coaches, use their own ID
  let actualCoachId = userId
  if (isAdmin) {
    actualCoachId = client.invitedByCoachId || 
      client.CohortMembership[0]?.Cohort.coachId || 
      userId
  }

  // Generate a unique code (retry if collision)
  let code: string
  let attempts = 0
  const maxAttempts = 10

  do {
    code = generatePairingCode()
    const existing = await db.pairingCode.findUnique({ where: { code } })
    if (!existing) break
    attempts++
  } while (attempts < maxAttempts)

  if (attempts >= maxAttempts) {
    throw new Error("Failed to generate unique pairing code")
  }

  const expiresAt = generateExpirationTime()

  return db.pairingCode.create({
    data: {
      code,
      coachId: actualCoachId,
      clientId,
      expiresAt,
    },
  })
}

/**
 * Regenerate a pairing code for a client (invalidates previous codes)
 * Useful when client gets a new phone or loses access
 * @param userId The user (coach or admin) regenerating the code
 * @param clientId The client this code is for
 * @param isAdmin Whether the user is an admin (bypasses association check)
 * @returns The new pairing code record
 */
export async function regeneratePairingCode(userId: string, clientId: string, isAdmin = false) {
  // Invalidate any existing unused codes for this client
  await db.pairingCode.updateMany({
    where: {
      clientId,
      usedAt: null,
    },
    data: {
      // Mark as expired to prevent use
      expiresAt: new Date(0),
    },
  })

  // Create new code
  return createPairingCode(userId, clientId, isAdmin)
}

/**
 * Validate and use a pairing code
 * @param code The pairing code to validate
 * @returns The pairing code record with client info if valid, or error message
 */
export async function validateAndUsePairingCode(
  code: string
): Promise<{ success: true; pairingCode: any; coachId: string; clientId: string } | { success: false; error: string }> {
  // Format validation
  if (!isValidCodeFormat(code)) {
    return { success: false, error: "Invalid code format" }
  }

  const normalizedCode = code.toUpperCase()

  // Find the pairing code
  const pairingCode = await db.pairingCode.findUnique({
    where: { code: normalizedCode },
    include: { 
      Coach: { select: { id: true, name: true, email: true } },
      Client: { select: { id: true, name: true, email: true } }
    },
  })

  if (!pairingCode) {
    return { success: false, error: "Pairing code not found" }
  }

  // Check if already used
  if (pairingCode.usedAt) {
    return { success: false, error: "Pairing code has already been used" }
  }

  // Check if expired
  if (new Date() > pairingCode.expiresAt) {
    return { success: false, error: "Pairing code has expired" }
  }

  // Verify code has a client assigned (should always be true with new model)
  if (!pairingCode.clientId) {
    return { success: false, error: "Invalid pairing code - no client assigned" }
  }

  // Mark as used
  const updatedCode = await db.pairingCode.update({
    where: { id: pairingCode.id },
    data: {
      usedAt: new Date(),
    },
    include: { 
      Coach: { select: { id: true, name: true, email: true } },
      Client: { select: { id: true, name: true, email: true } }
    },
  })

  return {
    success: true,
    pairingCode: updatedCode,
    coachId: pairingCode.coachId,
    clientId: pairingCode.clientId,
  }
}

/**
 * Get all active (unused, unexpired) pairing codes for a coach
 * @param coachId The coach ID
 * @returns Array of active pairing codes
 */
export async function getActiveCodesForCoach(coachId: string) {
  return db.pairingCode.findMany({
    where: {
      coachId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  })
}

/**
 * Clean up expired pairing codes (for maintenance)
 * @returns Number of deleted codes
 */
export async function cleanupExpiredCodes(): Promise<number> {
  const result = await db.pairingCode.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
      usedAt: null, // Only delete unused expired codes
    },
  })
  return result.count
}
