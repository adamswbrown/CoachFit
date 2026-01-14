import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { NextResponse } from "next/server"
import { z } from "zod"

const pairDeviceSchema = z.object({
  pairingCode: z.string().length(6).regex(/^\d+$/, "Code must be 6 digits"),
})

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    if (!isClient(session.user)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const parsed = pairDeviceSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid pairing code format" },
        { status: 400 }
      )
    }

    const { pairingCode } = parsed.data

    // Find the pairing code
    const code = await db.pairingCode.findUnique({
      where: { code: pairingCode },
    })

    if (!code) {
      return NextResponse.json(
        { error: "Invalid or expired pairing code" },
        { status: 404 }
      )
    }

    // Check if code is already paired to a different user
    if (code.usedAt && code.clientId !== session.user.id) {
      return NextResponse.json(
        { error: "Pairing code is already in use" },
        { status: 409 }
      )
    }

    // Check if code has expired
    if (new Date() > code.expiresAt) {
      return NextResponse.json(
        { error: "Pairing code has expired" },
        { status: 410 }
      )
    }

    // Pair the code to the current user
    await db.pairingCode.update({
      where: { code: pairingCode },
      data: {
        clientId: session.user.id,
        usedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: "Device paired successfully",
    })
  } catch (error) {
    console.error("Error pairing device:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
