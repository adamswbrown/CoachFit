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
      <p className="text-sm text-neutral-400 py-4">
        No notes yet. Write your first check-in note above.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {notes.map((note) => (
        <div key={note.id} className="border-l-2 border-neutral-200 pl-4 py-1">
          <div className="text-xs text-neutral-400 mb-1">
            {new Date(note.noteDate).toLocaleDateString("en-GB", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </div>
          <p className="text-sm text-neutral-700 whitespace-pre-wrap">{note.note}</p>
        </div>
      ))}
    </div>
  )
}
