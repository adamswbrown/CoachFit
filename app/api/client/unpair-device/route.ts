import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isClient } from "@/lib/permissions"

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

    const pairedCodeCount = await db.pairingCode.count({
      where: {
        clientId: session.user.id,
        usedAt: { not: null },
      },
    })

    if (pairedCodeCount === 0) {
      return NextResponse.json(
        { error: "No paired device found" },
        { status: 404 }
      )
    }

    // Revoke all previously paired tokens for this client.
    // Setting usedAt to null ensures ingest auth can no longer validate them.
    await db.pairingCode.updateMany({
      where: {
        clientId: session.user.id,
        usedAt: { not: null },
      },
      data: {
        usedAt: null,
        expiresAt: new Date(),
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
