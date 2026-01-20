"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
  enabled: boolean
  isSystem: boolean
  updatedAt: string
}

export default function EmailTemplatesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

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
    if (session?.user && isAdmin(session.user)) {
      fetchTemplates()
    }
  }, [session])

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/admin/email-templates")
      if (!response.ok) {
        throw new Error("Failed to fetch templates")
      }
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to load templates",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleToggleEnabled = async (key: string, currentEnabled: boolean) => {
    try {
      const response = await fetch(`/api/admin/email-templates/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !currentEnabled }),
      })

      if (!response.ok) {
        throw new Error("Failed to update template")
      }

      // Refresh templates
      await fetchTemplates()
      setMessage({
        type: "success",
        text: `Template ${currentEnabled ? "disabled" : "enabled"} successfully`,
      })
      setTimeout(() => setMessage(null), 3000)
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to update template",
      })
    }
  }

  if (loading) {
    return (
      <CoachLayout>
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-12">Loading email templates...</div>
        </div>
      </CoachLayout>
    )
  }

  if (!session || !isAdmin(session.user)) {
    return null
  }

  return (
    <CoachLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Email Templates</h1>
          <p className="text-neutral-600">
            Manage transactional email templates sent by the system
          </p>
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

        <div className="bg-white rounded-lg border border-neutral-200">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50">
                  <th className="text-left py-4 px-6 font-semibold text-neutral-900">Template</th>
                  <th className="text-left py-4 px-6 font-semibold text-neutral-900">Description</th>
                  <th className="text-left py-4 px-6 font-semibold text-neutral-900">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-neutral-900">Last Updated</th>
                  <th className="text-left py-4 px-6 font-semibold text-neutral-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-neutral-500">
                      No email templates found. Run the seed script to create default templates.
                    </td>
                  </tr>
                ) : (
                  templates.map((template) => (
                    <tr key={template.id} className="border-b border-neutral-100 hover:bg-neutral-50">
                      <td className="py-4 px-6">
                        <div>
                          <div className="font-medium text-neutral-900">{template.name}</div>
                          <div className="text-sm text-neutral-500 font-mono">{template.key}</div>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-neutral-600 text-sm max-w-md">
                        {template.description || "—"}
                      </td>
                      <td className="py-4 px-6">
                        {template.enabled ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-800">
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-neutral-600 text-sm">
                        {new Date(template.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-2">
                          <Link
                            href={`/admin/email-templates/${template.key}`}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Edit
                          </Link>
                          <button
                            onClick={() => handleToggleEnabled(template.key, template.enabled)}
                            className="text-neutral-600 hover:text-neutral-800 text-sm font-medium"
                          >
                            {template.enabled ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">ℹ️ About Email Templates</h3>
          <ul className="text-sm text-blue-800 space-y-2">
            <li>• Templates use <code className="bg-blue-100 px-1 py-0.5 rounded">{"{{tokenName}}"}</code> syntax for variable substitution</li>
            <li>• System templates cannot be deleted but can be disabled</li>
            <li>• Disabled templates will use hardcoded fallbacks</li>
            <li>• Changes take effect immediately for new emails</li>
          </ul>
        </div>
      </div>
    </CoachLayout>
  )
}
