import { NextResponse } from "next/server"
import { getSystemSettings } from "@/lib/system-settings"
import {
  DEFAULT_DATA_PROCESSING_HTML,
  DEFAULT_PRIVACY_HTML,
  DEFAULT_TERMS_HTML,
} from "@/lib/legal-content"

/**
 * GET /api/public/legal
 * Returns public legal content (terms/privacy/data processing).
 */
export async function GET() {
  try {
    const settings = await getSystemSettings()
    return NextResponse.json(
      {
        data: {
          termsContentHtml: settings.termsContentHtml || DEFAULT_TERMS_HTML,
          privacyContentHtml: settings.privacyContentHtml || DEFAULT_PRIVACY_HTML,
          dataProcessingContentHtml:
            settings.dataProcessingContentHtml || DEFAULT_DATA_PROCESSING_HTML,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching legal content:", error)
    return NextResponse.json(
      {
        data: {
          termsContentHtml: DEFAULT_TERMS_HTML,
          privacyContentHtml: DEFAULT_PRIVACY_HTML,
          dataProcessingContentHtml: DEFAULT_DATA_PROCESSING_HTML,
        },
      },
      { status: 200 }
    )
  }
}
