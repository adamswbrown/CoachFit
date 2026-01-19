import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach } from "@/lib/permissions"

const DEFAULT_ADHERENCE = {
  adherenceGreenMinimum: 6,
  adherenceAmberMinimum: 3,
}

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isAdminOrCoach(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    let settings = await db.systemSettings.findFirst({
      select: {
        adherenceGreenMinimum: true,
        adherenceAmberMinimum: true,
      } as any,
    })

    if (!settings) {
      settings = await db.systemSettings.create({
        data: {
          adherenceGreenMinimum: DEFAULT_ADHERENCE.adherenceGreenMinimum,
          adherenceAmberMinimum: DEFAULT_ADHERENCE.adherenceAmberMinimum,
        } as any,
        select: {
          adherenceGreenMinimum: true,
          adherenceAmberMinimum: true,
        } as any,
      })
    }

    return NextResponse.json({ data: settings }, { status: 200 })
  } catch (error) {
    console.error("Error fetching adherence settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
