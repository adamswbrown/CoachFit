import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GDPR Data Export Endpoint
 * GET /api/user/export-data?format=json|csv
 * Returns all user data in GDPR-compliant format
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const format = request.nextUrl.searchParams.get("format") || "json"

    // Fetch all user data
    const user = await (db.user.findUnique as any)({
      where: { id: session.user.id },
      include: {
        Account: true,
        Entry: {
          orderBy: { date: "desc" },
        },
        Workouts: {
          orderBy: { startTime: "desc" },
        },
        SleepRecords: {
          orderBy: { date: "desc" },
        },
        CoachNotes: {
          include: { coach: { select: { id: true, name: true, email: true } } },
          orderBy: { noteDate: "desc" },
        },
        CohortMembership: {
          include: { Cohort: { select: { id: true, name: true } } },
        },
        UserConsent: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Build GDPR-compliant export data
    const exportData = {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        roles: user.roles,
      },
      accounts: user.Account.map((acc) => ({
        provider: acc.provider,
        connectedAt: acc.id,
      })),
      entries: user.Entry.map((entry) => ({
        date: entry.date,
        weight: entry.weightLbs,
        steps: entry.steps,
        calories: entry.calories,
        height: entry.heightInches,
        sleepQuality: entry.sleepQuality,
        perceivedStress: entry.perceivedStress,
        notes: entry.notes,
        dataSources: entry.dataSources,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
      })),
      workouts: user.Workouts.map((workout) => ({
        type: workout.workoutType,
        startTime: workout.startTime,
        endTime: workout.endTime,
        durationSeconds: workout.durationSecs,
        caloriesActive: workout.caloriesActive,
        distanceMeters: workout.distanceMeters,
        avgHeartRate: workout.avgHeartRate,
        maxHeartRate: workout.maxHeartRate,
        sourceDevice: workout.sourceDevice,
        createdAt: workout.createdAt,
      })),
      sleepRecords: user.SleepRecords.map((sleep) => ({
        date: sleep.date,
        totalSleepMinutes: sleep.totalSleepMins,
        inBedMinutes: sleep.inBedMins,
        awakeMinutes: sleep.awakeMins,
        coreMinutes: sleep.asleepCoreMins,
        deepMinutes: sleep.asleepDeepMins,
        remMinutes: sleep.asleepREMMins,
        sourceDevices: sleep.sourceDevices,
        createdAt: sleep.createdAt,
      })),
      coachNotes: user.CoachNotes.map((note) => ({
        coach: note.coach.name || note.coach.email,
        weekStart: note.weekStart,
        noteDate: note.noteDate,
        note: note.note,
        createdAt: note.createdAt,
      })),
      cohortMemberships: user.CohortMembership.map((mem) => ({
        cohort: mem.Cohort.name,
        joinedAt: mem.Cohort.createdAt, // Approx join time
      })),
      consent: user.UserConsent
        ? {
            termsAccepted: user.UserConsent.termsAccepted,
            privacyAccepted: user.UserConsent.privacyAccepted,
            dataProcessing: user.UserConsent.dataProcessing,
            marketing: user.UserConsent.marketing,
            version: user.UserConsent.version,
            recordedAt: user.UserConsent.createdAt,
          }
        : null,
      exportedAt: new Date().toISOString(),
    }

    if (format === "csv") {
      return generateCSV(exportData)
    }

    // Default to JSON
    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="coachfit-data-export-${Date.now()}.json"`,
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("Error exporting user data:", error)
    return NextResponse.json(
      { error: "Failed to export data" },
      { status: 500 }
    )
  }
}

function generateCSV(data: any) {
  const lines: string[] = []

  // User info
  lines.push("User Information")
  lines.push("Email,Name,ID,Created Date")
  lines.push(`"${data.user.email}","${data.user.name || ""}","${data.user.id}","${data.user.createdAt}"`)
  lines.push("")

  // Entries
  lines.push("Daily Entries")
  lines.push("Date,Weight (lbs),Steps,Calories,Height (in),Sleep Quality,Perceived Stress,Notes,Data Sources")
  data.entries.forEach((entry: any) => {
    lines.push(
      `"${entry.date}","${entry.weight || ""}","${entry.steps || ""}","${entry.calories || ""}","${entry.height || ""}","${entry.sleepQuality || ""}","${entry.perceivedStress || ""}","${entry.notes || ""}","${Array.isArray(entry.dataSources) ? entry.dataSources.join(";") : ""}"` 
    )
  })
  lines.push("")

  // Workouts
  lines.push("Workouts")
  lines.push("Type,Start Time,End Time,Duration (mins),Calories,Distance (m),Avg Heart Rate,Max Heart Rate,Device")
  data.workouts.forEach((workout: any) => {
    lines.push(
      `"${workout.type}","${workout.startTime}","${workout.endTime}","${Math.round(workout.durationSeconds / 60)}","${workout.caloriesActive || ""}","${workout.distanceMeters || ""}","${workout.avgHeartRate || ""}","${workout.maxHeartRate || ""}","${workout.sourceDevice || ""}"`
    )
  })
  lines.push("")

  // Sleep
  lines.push("Sleep Records")
  lines.push("Date,Total Sleep (mins),In Bed (mins),Awake (mins),Core (mins),Deep (mins),REM (mins)")
  data.sleepRecords.forEach((sleep: any) => {
    lines.push(
      `"${sleep.date}","${sleep.totalSleepMinutes}","${sleep.inBedMinutes || ""}","${sleep.awakeMinutes || ""}","${sleep.coreMinutes || ""}","${sleep.deepMinutes || ""}","${sleep.remMinutes || ""}"`
    )
  })

  const csv = lines.join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="coachfit-data-export-${Date.now()}.csv"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  })
}
