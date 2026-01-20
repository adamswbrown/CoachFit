"use client"

import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Link from "@tiptap/extension-link"
import TextAlign from "@tiptap/extension-text-align"
import Underline from "@tiptap/extension-underline"
import { useEffect } from "react"

interface EmailEditorProps {
  content: string
  onChange: (html: string) => void
  availableTokens?: string[]
}

export function EmailEditor({ content, onChange, availableTokens = [] }: EmailEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-blue-600 underline",
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none min-h-[300px] px-3 py-2 border border-neutral-300 rounded-md",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
  })

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content)
    }
  }, [content, editor])

  const insertToken = (token: string) => {
    if (editor) {
      editor.chain().focus().insertContent(`{{${token}}}`).run()
    }
  }

  if (!editor) {
    return null
  }

  return (
    <div className="space-y-2">
      <div className="border border-neutral-300 rounded-md overflow-hidden bg-white">
        {/* Toolbar */}
        <div className="flex flex-wrap gap-1 p-2 border-b border-neutral-200 bg-neutral-50">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`px-3 py-1.5 text-sm font-semibold rounded hover:bg-neutral-200 ${
              editor.isActive("bold") ? "bg-neutral-300" : "bg-white"
            }`}
            title="Bold"
          >
            B
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`px-3 py-1.5 text-sm italic rounded hover:bg-neutral-200 ${
              editor.isActive("italic") ? "bg-neutral-300" : "bg-white"
            }`}
            title="Italic"
          >
            I
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            className={`px-3 py-1.5 text-sm underline rounded hover:bg-neutral-200 ${
              editor.isActive("underline") ? "bg-neutral-300" : "bg-white"
            }`}
            title="Underline"
          >
            U
          </button>

          <div className="w-px h-6 bg-neutral-300 mx-1" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`px-3 py-1.5 text-sm rounded hover:bg-neutral-200 ${
              editor.isActive("heading", { level: 1 }) ? "bg-neutral-300" : "bg-white"
            }`}
            title="Heading 1"
          >
            H1
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`px-3 py-1.5 text-sm rounded hover:bg-neutral-200 ${
              editor.isActive("heading", { level: 2 }) ? "bg-neutral-300" : "bg-white"
            }`}
            title="Heading 2"
          >
            H2
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setParagraph().run()}
            className={`px-3 py-1.5 text-sm rounded hover:bg-neutral-200 ${
              editor.isActive("paragraph") ? "bg-neutral-300" : "bg-white"
            }`}
            title="Paragraph"
          >
            P
          </button>

          <div className="w-px h-6 bg-neutral-300 mx-1" />

          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`px-3 py-1.5 text-sm rounded hover:bg-neutral-200 ${
              editor.isActive("bulletList") ? "bg-neutral-300" : "bg-white"
            }`}
            title="Bullet List"
          >
            •
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={`px-3 py-1.5 text-sm rounded hover:bg-neutral-200 ${
              editor.isActive("orderedList") ? "bg-neutral-300" : "bg-white"
            }`}
            title="Numbered List"
          >
            1.
          </button>

          <div className="w-px h-6 bg-neutral-300 mx-1" />

          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
            className={`px-3 py-1.5 text-sm rounded hover:bg-neutral-200 ${
              editor.isActive({ textAlign: "left" }) ? "bg-neutral-300" : "bg-white"
            }`}
            title="Align Left"
          >
            ⬅
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
            className={`px-3 py-1.5 text-sm rounded hover:bg-neutral-200 ${
              editor.isActive({ textAlign: "center" }) ? "bg-neutral-300" : "bg-white"
            }`}
            title="Align Center"
          >
            ↔
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
            className={`px-3 py-1.5 text-sm rounded hover:bg-neutral-200 ${
              editor.isActive({ textAlign: "right" }) ? "bg-neutral-300" : "bg-white"
            }`}
            title="Align Right"
          >
            ➡
          </button>

          <div className="w-px h-6 bg-neutral-300 mx-1" />

          <button
            type="button"
            onClick={() => {
              const url = window.prompt("Enter URL:")
              if (url) {
                editor.chain().focus().setLink({ href: url }).run()
              }
            }}
            className={`px-3 py-1.5 text-sm rounded hover:bg-neutral-200 ${
              editor.isActive("link") ? "bg-neutral-300" : "bg-white"
            }`}
            title="Add Link"
          >
            🔗
          </button>
          {editor.isActive("link") && (
            <button
              type="button"
              onClick={() => editor.chain().focus().unsetLink().run()}
              className="px-3 py-1.5 text-sm rounded hover:bg-neutral-200 bg-white"
              title="Remove Link"
            >
              ⛓️‍💥
            </button>
          )}
        </div>

        {/* Editor */}
        <EditorContent editor={editor} />
      </div>

      {/* Available Tokens */}
      {availableTokens.length > 0 && (
        <div className="mt-2">
          <p className="text-xs text-neutral-600 mb-1">Available tokens (click to insert):</p>
          <div className="flex flex-wrap gap-1">
            {availableTokens.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => insertToken(token)}
                className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 border border-blue-200"
              >
                {`{{${token}}}`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
