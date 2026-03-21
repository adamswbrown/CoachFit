import { NextRequest, NextResponse } from "next/server"
import { getSessionWithMobile } from "@/lib/auth-mobile"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionWithMobile()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Authorization: mobile clients can only access their own notes.
    // Web users must be the client themselves OR an admin/coach.
    const isSelf = session.user.id === id
    if (!isSelf && !isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const notes = await db.coachNote.findMany({
      where: {
        clientId: id,
        sharedWithClient: true,
      },
      include: {
        coach: {
          select: { name: true },
        },
      },
      orderBy: {
        noteDate: "desc",
      },
    })

    return NextResponse.json({
      notes: notes.map((n) => ({
        id: n.id,
        noteDate: n.noteDate,
        note: n.note,
        sharedAt: n.sharedAt,
        weekNumber: n.weekNumber,
        coach: { name: n.coach.name },
      })),
    })
  } catch (error) {
    console.error("Error fetching shared notes:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
