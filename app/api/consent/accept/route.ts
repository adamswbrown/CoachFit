import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

export const dynamic = "force-dynamic"

const consentSchema = z.object({
  termsAccepted: z.boolean(),
  privacyAccepted: z.boolean(),
  dataProcessing: z.boolean(),
  marketing: z.boolean().optional(),
})

/**
 * Consent Accept Endpoint
 * POST /api/consent/accept
 * Records user consent for GDPR compliance
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validation = consentSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid consent data" },
        { status: 400 }
      )
    }

    const { termsAccepted, privacyAccepted, dataProcessing, marketing } =
      validation.data

    // All required consents must be true
    if (!termsAccepted || !privacyAccepted || !dataProcessing) {
      return NextResponse.json(
        {
          error: "Terms, Privacy, and Data Processing consent are required",
        },
        { status: 400 }
      )
    }

    // Get IP address for audit trail
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("cf-connecting-ip") ||
      "unknown"

    const userAgent = request.headers.get("user-agent") || undefined

    // Create or update user consent
    const now = new Date()
    const dbClient = db as any
    const consent = await dbClient.userConsent.upsert({
      where: { userId: session.user.id },
      update: {
        termsAccepted: now,
        privacyAccepted: now,
        dataProcessing: now,
        marketing: marketing ? now : null,
        version: "1.0",
        ipAddress: ip,
        userAgent,
        updatedAt: now,
      },
      create: {
        userId: session.user.id,
        termsAccepted: now,
        privacyAccepted: now,
        dataProcessing: now,
        marketing: marketing ? now : null,
        version: "1.0",
        ipAddress: ip,
        userAgent,
      },
    })

    return NextResponse.json({
      message: "Consent recorded successfully",
      consent: {
        id: consent.id,
        recordedAt: consent.createdAt,
      },
    })
  } catch (error) {
    console.error("Error recording consent:", error)
    return NextResponse.json(
      { error: "Failed to record consent" },
      { status: 500 }
    )
  }
}

/**
 * Get current user's consent status
 * GET /api/consent/accept
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const dbClient = db as any
    const consent = await dbClient.userConsent.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        termsAccepted: true,
        privacyAccepted: true,
        dataProcessing: true,
        marketing: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({
      hasConsent: !!consent,
      consent: consent || null,
    })
  } catch (error) {
    console.error("Error fetching consent:", error)
    return NextResponse.json(
      { error: "Failed to fetch consent" },
      { status: 500 }
    )
  }
}
