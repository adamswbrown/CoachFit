"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { isAdmin } from "@/lib/permissions"
import { Role } from "@/lib/types"
import { CoachLayout } from "@/components/layouts/CoachLayout"
import Link from "next/link"

interface EmailTemplate {
  id: string
  key: string
  name: string
  description: string | null
  subjectTemplate: string
  bodyTemplate: string
  textTemplate: string
  availableTokens: string[]
  enabled: boolean
  isSystem: boolean
  updatedAt: string
}

const MOCK_VARIABLES: Record<string, string> = {
  userName: " John Doe",
  userEmail: "john@example.com",
  coachName: "Sarah Coach",
  coachEmail: "sarah@example.com",
  cohortName: "Elite Athletes 2024",
  loginUrl: "https://coachfit.app/login",
  appName: "CoachFit",
}

export default function EditEmailTemplatePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const templateKey = params?.key as string

  const [template, setTemplate] = useState<EmailTemplate | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [preview, setPreview] = useState<{ subject: string; html: string; text: string } | null>(
    null
  )

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    subjectTemplate: "",
    bodyTemplate: "",
    textTemplate: "",
    enabled: true,
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    } else if (session?.user && !isAdmin(session.user)) {
      if (session.user.roles.includes(Role.COACH)) {
        router.push("/coach-dashboard")
      } else {
        router.push("/client-dashboard")
      }
    }
  }, [status, session, router])

  useEffect(() => {
    if (session?.user && isAdmin(session.user) && templateKey) {
      fetchTemplate()
    }
  }, [session, templateKey])

  const fetchTemplate = async () => {
    try {
      const response = await fetch(`/api/admin/email-templates/${templateKey}`)
      if (!response.ok) {
        throw new Error("Failed to fetch template")
      }
      const data = await response.json()
      setTemplate(data.template)
      setFormData({
        name: data.template.name,
        description: data.template.description || "",
        subjectTemplate: data.template.subjectTemplate,
        bodyTemplate: data.template.bodyTemplate,
        textTemplate: data.template.textTemplate,
        enabled: data.template.enabled,
      })
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load template",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/admin/email-templates/${templateKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to save template")
      }

      const data = await response.json()
      setTemplate(data.template)
      setMessage({ type: "success", text: "Template saved successfully!" })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save template",
      })
    } finally {
      setSaving(false)
    }
  }

  const handlePreview = async () => {
    try {
      const response = await fetch("/api/admin/email-templates/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subjectTemplate: formData.subjectTemplate,
          bodyTemplate: formData.bodyTemplate,
          textTemplate: formData.textTemplate,
          mockVariables: MOCK_VARIABLES,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to generate preview")
      }

      const data = await response.json()
      setPreview(data.preview)
      setShowPreview(true)
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to generate preview",
      })
    }
  }

  if (loading) {
    return (
      <CoachLayout>
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">Loading template...</div>
        </div>
      </CoachLayout>
    )
  }

  if (!session || !isAdmin(session.user) || !template) {
    return null
  }

  return (
    <CoachLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link
            href="/admin/email-templates"
            className="text-blue-600 hover:text-blue-800 text-sm mb-4 inline-block"
          >
            ← Back to Email Templates
          </Link>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Edit Email Template</h1>
          <p className="text-neutral-600">{template.name}</p>
        </div>

        {message && (
          <div
            className={`mb-8 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 border border-green-200 text-green-800"
                : "bg-red-50 border border-red-200 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border border-neutral-200 p-6">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">Template Content</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Subject Template
                  </label>
                  <input
                    type="text"
                    value={formData.subjectTemplate}
                    onChange={(e) => setFormData({ ...formData, subjectTemplate: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    HTML Body Template
                  </label>
                  <textarea
                    value={formData.bodyTemplate}
                    onChange={(e) => setFormData({ ...formData, bodyTemplate: e.target.value })}
                    rows={12}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Plain Text Template
                  </label>
                  <textarea
                    value={formData.textTemplate}
                    onChange={(e) => setFormData({ ...formData, textTemplate: e.target.value })}
                    rows={8}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="w-4 h-4 border border-neutral-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm font-medium text-neutral-700">
                    Template Enabled
                  </label>
                </div>
              </div>

              <div className="flex gap-4 mt-6">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 font-medium"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={handlePreview}
                  className="px-6 py-2 bg-neutral-200 text-neutral-900 rounded-md hover:bg-neutral-300 font-medium"
                >
                  Preview
                </button>
                <button
                  onClick={() => router.push("/admin/email-templates")}
                  className="px-6 py-2 bg-neutral-200 text-neutral-900 rounded-md hover:bg-neutral-300 font-medium"
                >
                  Cancel
                </button>
              </div>
            </div>

            {showPreview && preview && (
              <div className="bg-white rounded-lg border border-neutral-200 p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-neutral-900">Preview</h2>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="text-neutral-600 hover:text-neutral-800"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Subject
                    </label>
                    <div className="p-3 bg-neutral-50 rounded border border-neutral-200">
                      {preview.subject}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      HTML Preview
                    </label>
                    <div
                      className="p-4 bg-neutral-50 rounded border border-neutral-200 overflow-auto max-h-96"
                      dangerouslySetInnerHTML={{ __html: preview.html }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Plain Text
                    </label>
                    <pre className="p-3 bg-neutral-50 rounded border border-neutral-200 text-sm whitespace-pre-wrap">
                      {preview.text}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-3">Available Tokens</h3>
              <div className="space-y-2">
                {template.availableTokens.map((token) => (
                  <div key={token} className="flex items-center gap-2">
                    <code className="bg-blue-100 px-2 py-1 rounded text-sm text-blue-900">
                      {`{{${token}}}`}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`{{${token}}}`)
                      }}
                      className="text-blue-600 hover:text-blue-800 text-xs"
                      title="Copy to clipboard"
                    >
                      📋
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-amber-900 mb-3">⚠️ Important Notes</h3>
              <ul className="text-sm text-amber-800 space-y-2">
                <li>• System templates cannot be deleted</li>
                <li>• Changes take effect immediately</li>
                <li>• Use only whitelisted tokens</li>
                <li>• HTML is auto-escaped for security</li>
                <li>• Test with preview before saving</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </CoachLayout>
  )
}
