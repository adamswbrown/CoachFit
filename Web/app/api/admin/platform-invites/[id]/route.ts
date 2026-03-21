import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/permissions"
import { logAuditAction } from "@/lib/audit-log"

// DELETE /api/admin/platform-invites/[id] - Revoke a pending invite
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { id } = await params

    const invite = await db.platformInvite.findUnique({ where: { id } })
    if (!invite) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 })
    }
    if (invite.usedAt) {
      return NextResponse.json({ error: "Cannot revoke an invite that has already been used" }, { status: 400 })
    }

    await db.platformInvite.delete({ where: { id } })

    await logAuditAction({
      actor: session.user,
      actionType: "PLATFORM_INVITE_REVOKE",
      targetType: "platform_invite",
      targetId: id,
      details: { email: invite.email },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting platform invite:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
