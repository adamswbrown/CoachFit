import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { previewEmailTemplate } from "@/lib/email-templates"
import { z } from "zod"

const previewSchema = z.object({
  subjectTemplate: z.string(),
  bodyTemplate: z.string(),
  textTemplate: z.string(),
  mockVariables: z.record(z.string(), z.string()),
})

// POST /api/admin/email-templates/preview - Preview a template with mock data
export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const body = await req.json()
    const { subjectTemplate, bodyTemplate, textTemplate, mockVariables } =
      previewSchema.parse(body)

    const preview = previewEmailTemplate(
      subjectTemplate,
      bodyTemplate,
      textTemplate,
      mockVariables
    )

    return NextResponse.json({ preview }, { status: 200 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      )
    }
    console.error("Error previewing email template:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
