import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/permissions"
import { getAllEmailTemplates } from "@/lib/email-templates"

// GET /api/admin/email-templates - List all email templates
export async function GET(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 })
    }

    const templates = await getAllEmailTemplates()

    return NextResponse.json({ templates }, { status: 200 })
  } catch (error) {
    console.error("Error fetching email templates:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
