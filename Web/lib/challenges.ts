import { db } from "@/lib/db"
import { logAuditAction } from "@/lib/audit-log"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChallengeProgress {
  daysCompleted: number
  totalDays: number
  streak: number
  weeklyEntries: Record<number, number>
  checkInRate: number
  percentComplete: number
}

export interface ChallengeWithMembership {
  id: string
  name: string
  coachId: string
  cohortStartDate: Date | null
  durationWeeks: number | null
  durationConfig: string
  membershipDurationMonths: number | null
  checkInFrequencyDays: number | null
  memberCount: number
}

// ---------------------------------------------------------------------------
// enrollInChallenge
// ---------------------------------------------------------------------------

/**
 * Enroll a client into a CHALLENGE cohort.
 * Validates the cohort type and prevents duplicate memberships.
 * Runs inside a db.$transaction() for atomicity.
 */
export async function enrollInChallenge(
  clientId: string,
  cohortId: string
): Promise<void> {
  await db.$transaction(async (tx) => {
    // Fetch and validate the cohort
    const cohort = await tx.cohort.findUnique({
      where: { id: cohortId },
      select: { id: true, type: true, name: true, coachId: true },
    })

    if (!cohort) {
      throw new Error("Challenge not found")
    }

    if (cohort.type !== "CHALLENGE") {
      throw new Error("Cohort is not a challenge")
    }

    // Check if user is already a member of THIS cohort
    const existing = await tx.cohortMembership.findUnique({
      where: {
        userId_cohortId: {
          userId: clientId,
          cohortId,
        },
      },
    })

    if (existing) {
      throw new Error("Already enrolled in this challenge")
    }

    // Create the membership
    await tx.cohortMembership.create({
      data: {
        userId: clientId,
        cohortId,
      },
    })
  })

  // Audit outside the transaction (fire-and-forget on failure)
  await logAuditAction({
    actor: { id: clientId },
    actionType: "CHALLENGE_ENROLL",
    targetType: "cohort",
    targetId: cohortId,
    details: { cohortId },
  })
}

// ---------------------------------------------------------------------------
// completeChallenge
// ---------------------------------------------------------------------------

/**
 * Mark a challenge as complete.
 * The actual completion state is tracked externally (e.g. Milestone records).
 * This function verifies the cohort type and logs the action.
 */
export async function completeChallenge(
  cohortId: string,
  actorId: string
): Promise<void> {
  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: { id: true, type: true, name: true },
  })

  if (!cohort) {
    throw new Error("Challenge not found")
  }

  if (cohort.type !== "CHALLENGE") {
    throw new Error("Cohort is not a challenge")
  }

  await logAuditAction({
    actor: { id: actorId },
    actionType: "CHALLENGE_COMPLETE",
    targetType: "cohort",
    targetId: cohortId,
    details: { cohortId, cohortName: cohort.name },
  })
}

// ---------------------------------------------------------------------------
// getChallengeProgress
// ---------------------------------------------------------------------------

/**
 * Calculate a client's progress within a specific CHALLENGE cohort.
 *
 * Returns:
 *  - daysCompleted: number of days in range that have an Entry
 *  - totalDays: durationWeeks * 7 (capped at days elapsed if challenge ongoing)
 *  - streak: consecutive days with entries counting back from today
 *  - weeklyEntries: { [weekNumber]: entryCount }
 *  - checkInRate: daysCompleted / totalDays (0–1)
 *  - percentComplete: checkInRate * 100
 */
export async function getChallengeProgress(
  clientId: string,
  cohortId: string
): Promise<ChallengeProgress> {
  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      type: true,
      cohortStartDate: true,
      durationWeeks: true,
    },
  })

  if (!cohort) throw new Error("Challenge not found")
  if (cohort.type !== "CHALLENGE") throw new Error("Cohort is not a challenge")

  const startDate = cohort.cohortStartDate
  const durationWeeks = cohort.durationWeeks ?? 6 // default to 6 weeks if unset

  // Determine date range
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const rangeStart = startDate ? new Date(startDate) : today
  rangeStart.setHours(0, 0, 0, 0)

  const rangeEnd = new Date(rangeStart)
  rangeEnd.setDate(rangeEnd.getDate() + durationWeeks * 7 - 1)

  const effectiveEnd = rangeEnd < today ? rangeEnd : today

  const totalDays = durationWeeks * 7

  // Fetch entries within the challenge window
  const entries = await db.entry.findMany({
    where: {
      userId: clientId,
      date: {
        gte: rangeStart,
        lte: effectiveEnd,
      },
    },
    select: { date: true },
    orderBy: { date: "asc" },
  })

  const entryDates = entries.map(
    (e) => e.date.toISOString().split("T")[0]
  )
  const entryDateSet = new Set(entryDates)

  const daysCompleted = entryDates.length

  // Calculate streak (consecutive days backwards from today)
  let streak = 0
  {
    const cursor = new Date(today)
    while (true) {
      const dateStr = cursor.toISOString().split("T")[0]
      if (entryDateSet.has(dateStr)) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      } else if (streak === 0 && cursor.toDateString() === today.toDateString()) {
        // Forgive today — check yesterday
        cursor.setDate(cursor.getDate() - 1)
        continue
      } else {
        break
      }
    }
  }

  // Group entries by week number relative to challenge start
  const weeklyEntries: Record<number, number> = {}
  for (const dateStr of entryDates) {
    const entryDate = new Date(dateStr + "T00:00:00")
    const msFromStart = entryDate.getTime() - rangeStart.getTime()
    const weekNum = Math.floor(msFromStart / (7 * 24 * 3600 * 1000)) + 1
    weeklyEntries[weekNum] = (weeklyEntries[weekNum] ?? 0) + 1
  }

  const checkInRate = totalDays > 0 ? daysCompleted / totalDays : 0
  const percentComplete = Math.round(checkInRate * 100)

  return {
    daysCompleted,
    totalDays,
    streak,
    weeklyEntries,
    checkInRate,
    percentComplete,
  }
}

// ---------------------------------------------------------------------------
// getActiveChallenges
// ---------------------------------------------------------------------------

/**
 * Return CHALLENGE cohorts the client is currently enrolled in where the
 * challenge period has not yet ended.
 */
export async function getActiveChallenges(
  clientId: string
): Promise<ChallengeWithMembership[]> {
  const memberships = await db.cohortMembership.findMany({
    where: { userId: clientId },
    include: {
      Cohort: {
        include: {
          _count: { select: { memberships: true } },
        },
      },
    },
  })

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const active: ChallengeWithMembership[] = []

  for (const m of memberships) {
    const c = m.Cohort
    if (c.type !== "CHALLENGE") continue

    const start = c.cohortStartDate ? new Date(c.cohortStartDate) : null
    const weeks = c.durationWeeks ?? 6

    if (start) {
      const end = new Date(start)
      end.setDate(end.getDate() + weeks * 7)
      if (end <= now) continue // already ended
    }

    active.push({
      id: c.id,
      name: c.name,
      coachId: c.coachId,
      cohortStartDate: c.cohortStartDate,
      durationWeeks: c.durationWeeks,
      durationConfig: c.durationConfig,
      membershipDurationMonths: c.membershipDurationMonths,
      checkInFrequencyDays: c.checkInFrequencyDays,
      memberCount: c._count.memberships,
    })
  }

  return active
}

// ---------------------------------------------------------------------------
// getChallengeHistory
// ---------------------------------------------------------------------------

/**
 * Return CHALLENGE cohorts the client was enrolled in where the challenge
 * period has already ended.
 */
export async function getChallengeHistory(
  clientId: string
): Promise<ChallengeWithMembership[]> {
  const memberships = await db.cohortMembership.findMany({
    where: { userId: clientId },
    include: {
      Cohort: {
        include: {
          _count: { select: { memberships: true } },
        },
      },
    },
  })

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  const history: ChallengeWithMembership[] = []

  for (const m of memberships) {
    const c = m.Cohort
    if (c.type !== "CHALLENGE") continue

    const start = c.cohortStartDate ? new Date(c.cohortStartDate) : null
    const weeks = c.durationWeeks ?? 6

    if (start) {
      const end = new Date(start)
      end.setDate(end.getDate() + weeks * 7)
      if (end > now) continue // still active
    } else {
      continue // no start date — cannot determine if ended
    }

    history.push({
      id: c.id,
      name: c.name,
      coachId: c.coachId,
      cohortStartDate: c.cohortStartDate,
      durationWeeks: c.durationWeeks,
      durationConfig: c.durationConfig,
      membershipDurationMonths: c.membershipDurationMonths,
      checkInFrequencyDays: c.checkInFrequencyDays,
      memberCount: c._count.memberships,
    })
  }

  return history
}
