"use client"

import { useState } from "react"

interface CoachNoteEditorProps {
  clientId: string
  onSaved: () => void
}

export function CoachNoteEditor({ clientId, onSaved }: CoachNoteEditorProps) {
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!note.trim()) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/clients/${clientId}/coach-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note.trim() }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save note")
      }

      setNote("")
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Add a note about this client..."
        className="w-full min-h-[100px] p-3 border border-neutral-200 rounded-lg text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:border-transparent resize-y"
      />
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      <button
        onClick={handleSave}
        disabled={saving || !note.trim()}
        className="px-4 py-2 bg-neutral-900 text-white text-sm font-medium rounded-lg hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? "Saving..." : "Save Note"}
      </button>
    </div>
  )
}
