import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isCoach } from "@/lib/permissions"

// DELETE /api/invites/[id] - Cancel/delete an invite
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden: Coach access required" }, { status: 403 })
    }

    // Find the invite and verify ownership
    const invite = await db.coachInvite.findUnique({
      where: { id },
    })

    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }

    if (invite.coachId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden: Not your invite" }, { status: 403 })
    }

    await db.coachInvite.delete({
      where: { id },
    })

    return NextResponse.json({ message: "Invite cancelled" }, { status: 200 })
  } catch (error) {
    console.error("Error deleting invite:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
