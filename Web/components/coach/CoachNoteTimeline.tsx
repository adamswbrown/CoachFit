"use client"

interface CoachNote {
  id: string
  note: string
  noteDate: string
  createdAt: string
}

interface CoachNoteTimelineProps {
  notes: CoachNote[]
}

export function CoachNoteTimeline({ notes }: CoachNoteTimelineProps) {
  if (notes.length === 0) {
    return (
      <p className="text-sm text-neutral-500">No coach notes yet.</p>
    )
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => {
        const date = new Date(note.noteDate || note.createdAt)
        const formatted = date.toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })

        return (
          <div
            key={note.id}
            className="relative pl-6 border-l-2 border-neutral-200"
          >
            <div className="absolute -left-[5px] top-1.5 w-2 h-2 rounded-full bg-neutral-400" />
            <div className="text-xs text-neutral-500 mb-1">{formatted}</div>
            <p className="text-sm text-neutral-800 whitespace-pre-wrap">{note.note}</p>
          </div>
        )
      })}
    </div>
  )
}
