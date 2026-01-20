import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import {
  getEmailTemplate,
  updateEmailTemplate,
  previewEmailTemplate,
} from "@/lib/email-templates"
import { z } from "zod"

const updateTemplateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  subjectTemplate: z.string().optional(),
  bodyTemplate: z.string().optional(),
  textTemplate: z.string().optional(),
  enabled: z.boolean().optional(),
})

const previewTemplateSchema = z.object({
  subjectTemplate: z.string(),
  bodyTemplate: z.string(),
  textTemplate: z.string(),
  mockVariables: z.record(z.string()),
})

// GET /api/admin/email-templates/[key] - Get a single template
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await auth()
    const { key } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const template = await getEmailTemplate(key)

    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 })
    }

    return NextResponse.json({ template }, { status: 200 })
  } catch (error) {
    console.error("Error fetching email template:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// PUT /api/admin/email-templates/[key] - Update a template
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  try {
    const session = await auth()
    const { key } = await params

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const data = updateTemplateSchema.parse(body)

    const template = await updateEmailTemplate(key, data)

    return NextResponse.json({ template }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      )
    }
    console.error("Error updating email template:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
