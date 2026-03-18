import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { cronometerImportSchema } from "@/lib/validations"
import { Role } from "@/lib/types"

interface ImportRowResult {
  date: string
  action: "created" | "merged" | "skipped"
  fieldsUpdated: string[]
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!session.user.roles.includes(Role.CLIENT)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const parsed = cronometerImportSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.issues },
        { status: 400 }
      )
    }

    const { rows } = parsed.data
    const userId = session.user.id
    const results: ImportRowResult[] = []
    let created = 0
    let merged = 0
    let skipped = 0
    const errors: { date: string; message: string }[] = []

    for (const row of rows) {
      try {
        const date = new Date(row.date)
        date.setHours(0, 0, 0, 0)

        // Check for future dates
        const today = new Date()
        today.setHours(23, 59, 59, 999)
        if (date > today) {
          errors.push({ date: row.date, message: "Future date not allowed" })
          skipped++
          continue
        }

        const existing = await db.entry.findUnique({
          where: { userId_date: { userId, date } },
        })

        const macroFields = ["calories", "proteinGrams", "carbsGrams", "fatGrams", "fiberGrams", "weightLbs"] as const

        if (existing) {
          // Merge: only update fields that are null on existing entry
          const updateData: Record<string, number> = {}
          const fieldsUpdated: string[] = []

          for (const field of macroFields) {
            const newValue = row[field]
            if (newValue != null && (existing as any)[field] == null) {
              updateData[field] = newValue
              fieldsUpdated.push(field)
            }
          }

          if (Object.keys(updateData).length === 0) {
            results.push({ date: row.date, action: "skipped", fieldsUpdated: [] })
            skipped++
            continue
          }

          // Update dataSources to include "cronometer"
          const existingSources = Array.isArray(existing.dataSources)
            ? (existing.dataSources as string[])
            : []
          const dataSources = existingSources.includes("cronometer")
            ? existingSources
            : [...existingSources, "cronometer"]

          await db.entry.update({
            where: { id: existing.id },
            data: { ...updateData, dataSources },
          })

          results.push({ date: row.date, action: "merged", fieldsUpdated })
          merged++
        } else {
          // Create new entry
          const fieldsUpdated: string[] = []
          const optionalFields: Record<string, number> = {}
          for (const field of macroFields) {
            const value = row[field]
            if (value != null) {
              optionalFields[field] = value
              fieldsUpdated.push(field)
            }
          }

          await db.entry.create({
            data: {
              userId,
              date,
              dataSources: ["cronometer"],
              ...optionalFields,
            },
          })
          results.push({ date: row.date, action: "created", fieldsUpdated })
          created++
        }
      } catch (err: any) {
        errors.push({ date: row.date, message: err.message || "Unknown error" })
        skipped++
      }
    }

    // Auto-mark user as having Cronometer linked on successful import
    if (created > 0 || merged > 0) {
      await db.user.update({
        where: { id: userId },
        data: { cronometerLinked: true },
      })
    }

    return NextResponse.json({
      success: true,
      processed: rows.length,
      created,
      merged,
      skipped,
      results,
      ...(errors.length > 0 && { errors }),
    })
  } catch (error: any) {
    console.error("Error importing Cronometer data:", error)

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
