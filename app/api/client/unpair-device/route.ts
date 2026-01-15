import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"
import { NextResponse } from "next/server"

export async function POST() {
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

    // Find and reset the paired code for this user
    const pairingCode = await db.pairingCode.findFirst({
      where: {
        clientId: session.user.id,
        usedAt: { not: null },
      },
    })

    if (!pairingCode) {
      return NextResponse.json(
        { error: "No paired device found" },
        { status: 404 }
      )
    }

    // Reset the pairing
    await db.pairingCode.update({
      where: { id: pairingCode.id },
      data: {
        clientId: null,
        usedAt: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Device unpaired successfully",
    })
  } catch (error) {
    console.error("Error unpairing device:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
