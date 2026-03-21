"use client"

import { useState } from "react"

interface CoachNoteEditorProps {
  clientId: string
  onSaved: () => void
  defaultSharedWithClient?: boolean
  weekNumber?: number
}

export function CoachNoteEditor({ clientId, onSaved, defaultSharedWithClient, weekNumber }: CoachNoteEditorProps) {
  const [note, setNote] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sharedWithClient, setSharedWithClient] = useState(defaultSharedWithClient ?? false)

  const handleSave = async () => {
    if (!note.trim()) return

    setSaving(true)
    setError(null)

    try {
      const res = await fetch(`/api/clients/${clientId}/coach-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: note.trim(),
          noteDate: new Date().toISOString().split("T")[0],
          sharedWithClient,
          ...(weekNumber !== undefined && { weekNumber }),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save note")
      }

      setNote("")
      setSharedWithClient(defaultSharedWithClient ?? false)
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
      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input
          type="checkbox"
          checked={sharedWithClient}
          onChange={(e) => setSharedWithClient(e.target.checked)}
          className="rounded border-neutral-300 text-neutral-900 focus:ring-neutral-900"
        />
        <span>Share with member</span>
        <span className="text-neutral-400 text-xs">— Member will see this in their app</span>
      </label>
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
