import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdminOrCoach, isAdmin } from "@/lib/permissions"
import { sendSystemEmail } from "@/lib/email"
import { EMAIL_TEMPLATE_KEYS } from "@/lib/email-templates"

export async function POST(req: NextRequest) {
  try {
    const session = await auth()

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!isAdminOrCoach(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json()
    const { cohortId, weekNumber } = body

    if (!cohortId || !weekNumber) {
      return NextResponse.json(
        { error: "cohortId and weekNumber are required" },
        { status: 400 }
      )
    }

    if (weekNumber < 1 || weekNumber > 5) {
      return NextResponse.json(
        { error: "weekNumber must be between 1 and 5" },
        { status: 400 }
      )
    }

    // Verify coach has access to this cohort
    const cohort = await db.cohort.findUnique({
      where: { id: cohortId },
      include: {
        User: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        memberships: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                isTestUser: true,
              },
            },
          },
        },
      },
    })

    if (!cohort) {
      return NextResponse.json({ error: "Cohort not found" }, { status: 404 })
    }

    // Check ownership (only owner or admin can send reminders)
    if (cohort.coachId !== session.user.id && !isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (!cohort.cohortStartDate) {
      return NextResponse.json({ error: "Cohort start date not set" }, { status: 400 })
    }

    const getCurrentWeek = (startDate: Date) => {
      const start = new Date(startDate)
      const today = new Date()
      start.setUTCHours(0, 0, 0, 0)
      today.setUTCHours(0, 0, 0, 0)
      const diffMs = today.getTime() - start.getTime()
      if (diffMs < 0) return 0
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      return Math.min(5, Math.floor(diffDays / 7) + 1)
    }

    const currentWeek = getCurrentWeek(cohort.cohortStartDate)

    if (currentWeek < 1) {
      return NextResponse.json({ error: "Questionnaire not available yet" }, { status: 403 })
    }

    if (weekNumber !== currentWeek) {
      return NextResponse.json(
        { error: "Reminders can only be sent for the current week" },
        { status: 400 }
      )
    }

    // Get all responses for this cohort and week
    const responses = await db.weeklyQuestionnaireResponse.findMany({
      where: {
        cohortId,
        weekNumber,
      },
      select: {
        userId: true,
        status: true,
      },
    })

    // Create a map of userId -> status
    const responseMap = new Map(responses.map((r) => [r.userId, r.status]))

    // Filter clients who need reminders (in_progress or no response)
    const clientsNeedingReminder = cohort.memberships.filter((membership) => {
      const status = responseMap.get(membership.userId)
      return !status || status === "in_progress"
    })

    if (clientsNeedingReminder.length === 0) {
      return NextResponse.json({
        message: "No clients need a reminder for this week",
        sent: 0,
      })
    }

    // Send reminder emails
    let sentCount = 0
    const coachName = cohort.User.name || cohort.User.email
    const questionnaireUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/client-dashboard`

    for (const membership of clientsNeedingReminder) {
      const client = membership.user

      try {
        const result = await sendSystemEmail({
          templateKey: EMAIL_TEMPLATE_KEYS.WEEKLY_QUESTIONNAIRE_REMINDER,
          to: client.email,
          variables: {
            clientName: client.name || client.email,
            coachName,
            weekNumber: weekNumber.toString(),
            cohortName: cohort.name,
            questionnaireUrl,
          },
          isTestUser: client.isTestUser,
          fallbackSubject: `Reminder: Complete Week ${weekNumber} Questionnaire`,
          fallbackHtml: `
            <p>Hi ${client.name || client.email},</p>
            <p>This is a friendly reminder from ${coachName} to complete your Week ${weekNumber} questionnaire for <strong>${cohort.name}</strong>.</p>
            <p>Your weekly questionnaire helps your coach understand your progress, challenges, and wins.</p>
            <p><a href="${questionnaireUrl}">Complete Questionnaire</a></p>
            <p>Best,<br>${coachName}</p>
          `,
          fallbackText: `Hi ${client.name || client.email},

This is a friendly reminder from ${coachName} to complete your Week ${weekNumber} questionnaire for ${cohort.name}.

Complete your questionnaire here: ${questionnaireUrl}

Best,
${coachName}`,
        })

        if (result.success) {
          sentCount++
        }
      } catch (error) {
        console.error(`Failed to send reminder to ${client.email}:`, error)
      }
    }

    return NextResponse.json({
      message: `Sent ${sentCount} reminder emails`,
      sent: sentCount,
      total: clientsNeedingReminder.length,
    })
  } catch (error) {
    console.error("Error sending questionnaire reminders:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
