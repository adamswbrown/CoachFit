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

export interface BatchChallengeProgressResult {
  progress: Record<string, ChallengeProgress>
}

// ---------------------------------------------------------------------------
// getBatchChallengeProgress
// ---------------------------------------------------------------------------

/**
 * Calculate challenge progress for ALL members of a CHALLENGE cohort in
 * two DB queries (cohort+memberships, entries). Returns a map of clientId
 * to ChallengeProgress.
 */
export async function getBatchChallengeProgress(
  cohortId: string
): Promise<BatchChallengeProgressResult> {
  // 1. Fetch cohort + memberships in one query
  const cohort = await db.cohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      type: true,
      cohortStartDate: true,
      durationWeeks: true,
      memberships: { select: { userId: true } },
    },
  })

  if (!cohort) throw new Error("Challenge not found")
  if (cohort.type !== "CHALLENGE") throw new Error("Cohort is not a challenge")

  const clientIds = cohort.memberships.map((m) => m.userId)
  if (clientIds.length === 0) return { progress: {} }

  // 2. Compute date range (same logic as getChallengeProgress)
  const durationWeeks = cohort.durationWeeks ?? 6
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const rangeStart = cohort.cohortStartDate
    ? new Date(cohort.cohortStartDate)
    : today
  rangeStart.setHours(0, 0, 0, 0)

  const rangeEnd = new Date(rangeStart)
  rangeEnd.setDate(rangeEnd.getDate() + durationWeeks * 7 - 1)

  const effectiveEnd = rangeEnd < today ? rangeEnd : today
  const totalDays = durationWeeks * 7

  // 3. Single batch query for ALL member entries
  const allEntries = await db.entry.findMany({
    where: {
      userId: { in: clientIds },
      date: { gte: rangeStart, lte: effectiveEnd },
    },
    select: { userId: true, date: true },
    orderBy: { date: "asc" },
  })

  // 4. Group entries by clientId
  const entriesByClient = new Map<string, string[]>()
  for (const entry of allEntries) {
    const dateStr = entry.date.toISOString().split("T")[0]
    if (!entriesByClient.has(entry.userId)) {
      entriesByClient.set(entry.userId, [])
    }
    entriesByClient.get(entry.userId)!.push(dateStr)
  }

  // 5. Compute progress for each client (pure computation, no DB calls)
  const progress: Record<string, ChallengeProgress> = {}
  for (const clientId of clientIds) {
    const entryDates = entriesByClient.get(clientId) || []
    const entryDateSet = new Set(entryDates)
    const daysCompleted = entryDates.length

    // Streak: consecutive days backwards from today
    let streak = 0
    {
      const cursor = new Date(today)
      while (true) {
        const dateStr = cursor.toISOString().split("T")[0]
        if (entryDateSet.has(dateStr)) {
          streak++
          cursor.setDate(cursor.getDate() - 1)
        } else if (
          streak === 0 &&
          cursor.toDateString() === today.toDateString()
        ) {
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
      const weekNum =
        Math.floor(msFromStart / (7 * 24 * 3600 * 1000)) + 1
      weeklyEntries[weekNum] = (weeklyEntries[weekNum] ?? 0) + 1
    }

    const checkInRate = totalDays > 0 ? daysCompleted / totalDays : 0
    const percentComplete = Math.round(checkInRate * 100)

    progress[clientId] = {
      daysCompleted,
      totalDays,
      streak,
      weeklyEntries,
      checkInRate,
      percentComplete,
    }
  }

  return { progress }
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
 *
 * Business rule: a user can only be in ONE cohort at a time (@@unique([userId])).
 * If already in a cohort, throws an error — must leave current cohort first.
 */
export async function enrollInChallenge(
  clientId: string,
  cohortId: string
): Promise<void> {
  await db.$transaction(async (tx) => {
    // Validate the cohort
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

    // Check if user is already in ANY cohort (single-cohort model)
    const existing = await tx.cohortMembership.findUnique({
      where: { userId: clientId },
    })

    if (existing) {
      if (existing.cohortId === cohortId) {
        throw new Error("Already enrolled in this challenge")
      }
      throw new Error("Already in a cohort — leave your current cohort before joining a challenge")
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
 * Works regardless of whether the client is still a member (supports
 * viewing progress after membership removal for historical challenges).
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
  const durationWeeks = cohort.durationWeeks ?? 6

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const rangeStart = startDate ? new Date(startDate) : today
  rangeStart.setHours(0, 0, 0, 0)

  const rangeEnd = new Date(rangeStart)
  rangeEnd.setDate(rangeEnd.getDate() + durationWeeks * 7 - 1)

  const effectiveEnd = rangeEnd < today ? rangeEnd : today
  const totalDays = durationWeeks * 7

  const entries = await db.entry.findMany({
    where: {
      userId: clientId,
      date: { gte: rangeStart, lte: effectiveEnd },
    },
    select: { date: true },
    orderBy: { date: "asc" },
  })

  const entryDates = entries.map((e) => e.date.toISOString().split("T")[0])
  const entryDateSet = new Set(entryDates)
  const daysCompleted = entryDates.length

  // Streak: consecutive days backwards from today
  let streak = 0
  {
    const cursor = new Date(today)
    while (true) {
      const dateStr = cursor.toISOString().split("T")[0]
      if (entryDateSet.has(dateStr)) {
        streak++
        cursor.setDate(cursor.getDate() - 1)
      } else if (streak === 0 && cursor.toDateString() === today.toDateString()) {
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
 * Return the client's current CHALLENGE cohort if it hasn't ended yet.
 *
 * Single-cohort model: user has at most one CohortMembership at a time.
 * Returns an array (0 or 1 items) for API consistency.
 */
export async function getActiveChallenges(
  clientId: string
): Promise<ChallengeWithMembership[]> {
  const membership = await db.cohortMembership.findUnique({
    where: { userId: clientId },
    include: {
      Cohort: {
        include: {
          _count: { select: { memberships: true } },
        },
      },
    },
  })

  if (!membership) return []

  const c = membership.Cohort
  if (c.type !== "CHALLENGE") return []

  // Check if challenge is still active
  const now = new Date()
  now.setHours(0, 0, 0, 0)

  if (c.cohortStartDate) {
    const end = new Date(c.cohortStartDate)
    end.setDate(end.getDate() + (c.durationWeeks ?? 6) * 7)
    if (end <= now) return [] // ended
  }

  return [
    {
      id: c.id,
      name: c.name,
      coachId: c.coachId,
      cohortStartDate: c.cohortStartDate,
      durationWeeks: c.durationWeeks,
      durationConfig: c.durationConfig,
      membershipDurationMonths: c.membershipDurationMonths,
      checkInFrequencyDays: c.checkInFrequencyDays,
      memberCount: c._count.memberships,
    },
  ]
}

// ---------------------------------------------------------------------------
// getChallengeHistory
// ---------------------------------------------------------------------------

/**
 * Return past CHALLENGE cohorts the client participated in.
 *
 * Since a user can only be in one cohort at a time, past challenge memberships
 * are discovered via the audit log (CHALLENGE_ENROLL events). When a challenge
 * ends and the membership is removed, the audit trail preserves the history.
 */
export async function getChallengeHistory(
  clientId: string
): Promise<ChallengeWithMembership[]> {
  // Find all CHALLENGE_ENROLL audit entries for this client
  const enrollActions = await db.adminAction.findMany({
    where: {
      adminId: clientId, // actor.id is stored as adminId
      actionType: "CHALLENGE_ENROLL",
    },
    select: { targetId: true },
    orderBy: { createdAt: "desc" },
  })

  const cohortIds = enrollActions
    .map((a) => a.targetId)
    .filter((id): id is string => id !== null)

  if (cohortIds.length === 0) return []

  // Deduplicate
  const uniqueIds = [...new Set(cohortIds)]

  // Fetch those cohorts
  const cohorts = await db.cohort.findMany({
    where: {
      id: { in: uniqueIds },
      type: "CHALLENGE",
    },
    include: {
      _count: { select: { memberships: true } },
    },
  })

  const now = new Date()
  now.setHours(0, 0, 0, 0)

  // Exclude the user's current active challenge (if any)
  const currentMembership = await db.cohortMembership.findUnique({
    where: { userId: clientId },
    select: { cohortId: true },
  })
  const currentCohortId = currentMembership?.cohortId

  const history: ChallengeWithMembership[] = []

  for (const c of cohorts) {
    // Skip current cohort — that's "active", not history
    if (c.id === currentCohortId) continue

    // Only include ended challenges
    if (c.cohortStartDate) {
      const end = new Date(c.cohortStartDate)
      end.setDate(end.getDate() + (c.durationWeeks ?? 6) * 7)
      if (end > now) continue // still running
    } else {
      continue // can't determine if ended
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
