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
 * Create a new pairing code in the database
 * @param coachId The coach creating the code
 * @returns The created pairing code record
 */
export async function createPairingCode(coachId: string) {
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
      coachId,
      expiresAt,
    },
  })
}

/**
 * Validate and use a pairing code
 * @param code The pairing code to validate
 * @param clientId The client attempting to use the code
 * @returns The pairing code record if valid, or null with error message
 */
export async function validateAndUsePairingCode(
  code: string,
  clientId: string
): Promise<{ success: true; pairingCode: any; coachId: string } | { success: false; error: string }> {
  // Format validation
  if (!isValidCodeFormat(code)) {
    return { success: false, error: "Invalid code format" }
  }

  const normalizedCode = code.toUpperCase()

  // Find the pairing code
  const pairingCode = await db.pairingCode.findUnique({
    where: { code: normalizedCode },
    include: { Coach: { select: { id: true, name: true, email: true } } },
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

  // Mark as used
  const updatedCode = await db.pairingCode.update({
    where: { id: pairingCode.id },
    data: {
      clientId,
      usedAt: new Date(),
    },
    include: { Coach: { select: { id: true, name: true, email: true } } },
  })

  return {
    success: true,
    pairingCode: updatedCode,
    coachId: pairingCode.coachId,
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
