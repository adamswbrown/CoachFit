import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { Role } from "@prisma/client"
import { isAdmin } from "@/lib/permissions"
import { z } from "zod"

/**
 * Get Monday of a given date (start of week)
 */
function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust when day is Sunday
  return new Date(d.setDate(diff))
}

const upsertCoachNoteSchema = z.object({
  weekStart: z.string().optional().refine(
    (date) => {
      if (!date) return true
      const dateObj = new Date(date)
      return !isNaN(dateObj.getTime())
    },
    { message: "weekStart must be a valid date" }
  ),
  noteDate: z.string().refine(
    (date) => {
      const dateObj = new Date(date)
      return !isNaN(dateObj.getTime())
    },
    { message: "noteDate must be a valid date" }
  ),
  note: z.string().min(1, "Note cannot be empty").max(10000, "Note must be 10,000 characters or less"),
})

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Must be COACH or ADMIN
    const isCoach = session.user.roles.includes(Role.COACH)
    const isAdminUser = isAdmin(session.user)

    if (!isCoach && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify client exists
    const client = await db.user.findUnique({
      where: { id },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Authorization: If COACH, verify client is in at least one cohort owned by coach
    if (isCoach && !isAdminUser) {
      const membership = await db.cohortMembership.findFirst({
        where: {
          userId: id,
        Cohort: {
          coachId: session.user.id,
        },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: "Forbidden: Client not in your cohorts" },
          { status: 403 }
        )
      }
    }

    // Get weekStart or noteDate from query params (optional, returns all notes if not provided)
    const searchParams = req.nextUrl.searchParams
    const weekStartParam = searchParams.get("weekStart")
    const noteDateParam = searchParams.get("noteDate")

    if (weekStartParam) {
      // Fetch note for specific week (for backward compatibility)
      const weekStart = getMonday(new Date(weekStartParam))
      weekStart.setHours(0, 0, 0, 0)

      const note = await db.coachNote.findUnique({
        where: {
          coachId_clientId_weekStart: {
            coachId: session.user.id,
            clientId: id,
            weekStart: weekStart,
          },
        },
      })

      return NextResponse.json(note, { status: 200 })
    } else if (noteDateParam) {
      // Fetch note for specific date
      const noteDate = new Date(noteDateParam)
      noteDate.setHours(0, 0, 0, 0)
      const nextDay = new Date(noteDate)
      nextDay.setDate(nextDay.getDate() + 1)

      const note = await db.coachNote.findFirst({
        where: {
          coachId: session.user.id,
          clientId: id,
          noteDate: {
            gte: noteDate,
            lt: nextDay,
          },
        },
      })

      return NextResponse.json(note, { status: 200 })
    } else {
      // Fetch all notes for this client, ordered by date (most recent first)
      const notes = await db.coachNote.findMany({
        where: {
          coachId: session.user.id,
          clientId: id,
        },
        orderBy: {
          noteDate: "desc",
        },
      })

      return NextResponse.json(notes, { status: 200 })
    }
  } catch (error) {
    console.error("Error fetching coach notes:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    const { id } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Must be COACH or ADMIN
    const isCoach = session.user.roles.includes(Role.COACH)
    const isAdminUser = isAdmin(session.user)

    if (!isCoach && !isAdminUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Verify client exists
    const client = await db.user.findUnique({
      where: { id },
    })

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 })
    }

    // Authorization: If COACH, verify client is in at least one cohort owned by coach
    if (isCoach && !isAdminUser) {
      const membership = await db.cohortMembership.findFirst({
        where: {
          userId: id,
        Cohort: {
          coachId: session.user.id,
        },
        },
      })

      if (!membership) {
        return NextResponse.json(
          { error: "Forbidden: Client not in your cohorts" },
          { status: 403 }
        )
      }
    }

    const body = await req.json()
    const validated = upsertCoachNoteSchema.parse(body)

    // Parse noteDate
    const noteDate = new Date(validated.noteDate)
    noteDate.setHours(0, 0, 0, 0)

    // Convert weekStart to Monday of that week if provided (for backward compatibility)
    let weekStart: Date | undefined
    if (validated.weekStart) {
      weekStart = getMonday(new Date(validated.weekStart))
      weekStart.setHours(0, 0, 0, 0)
    } else {
      // If no weekStart provided, use Monday of the noteDate week
      weekStart = getMonday(noteDate)
      weekStart.setHours(0, 0, 0, 0)
    }

    // Check if a note already exists for this week (for backward compatibility)
    const existingNote = await db.coachNote.findUnique({
      where: {
        coachId_clientId_weekStart: {
          coachId: session.user.id,
          clientId: id,
          weekStart: weekStart,
        },
      },
    })

    if (existingNote) {
      // Update existing note
      const note = await db.coachNote.update({
        where: {
          id: existingNote.id,
        },
        data: {
          noteDate: noteDate,
          note: validated.note,
        },
      })

      return NextResponse.json(note, { status: 200 })
    } else {
      // Create new note
      const note = await db.coachNote.create({
        data: {
          coachId: session.user.id,
          clientId: id,
          weekStart: weekStart,
          noteDate: noteDate,
          note: validated.note,
        },
      })

      return NextResponse.json(note, { status: 201 })
    }
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error upserting coach note:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
