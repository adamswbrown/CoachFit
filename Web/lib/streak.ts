import { db } from "@/lib/db"

export interface StreakData {
  currentStreak: number
  longestStreak: number
  lastCheckInDate: string | null
  daysSinceLastCheckIn: number | null
}

/**
 * Calculate a user's current and longest check-in streak from Entry history.
 *
 * A streak is consecutive calendar days with at least one Entry.
 * "Today" is forgiven — if no entry today but entry yesterday, the streak
 * counts from yesterday (the user still has until midnight).
 */
export async function calculateStreak(userId: string): Promise<StreakData> {
  // Get all entry dates for user, ordered descending
  const entries = await db.entry.findMany({
    where: { userId },
    select: { date: true },
    orderBy: { date: "desc" },
  })

  if (entries.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastCheckInDate: null, daysSinceLastCheckIn: null }
  }

  // Deduplicate by date string (one entry per day guaranteed by schema, but be safe)
  const dateSet = new Set<string>()
  for (const e of entries) {
    dateSet.add(e.date.toISOString().split("T")[0])
  }
  const dates = Array.from(dateSet).sort().reverse() // newest first

  const lastCheckInDate = dates[0]
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split("T")[0]

  const lastDate = new Date(lastCheckInDate + "T00:00:00")
  const diffMs = today.getTime() - lastDate.getTime()
  const daysSinceLastCheckIn = Math.floor(diffMs / 86400000)

  // Calculate current streak
  // Start from the most recent entry date
  // If the most recent is today or yesterday, start counting
  let currentStreak = 0
  if (daysSinceLastCheckIn <= 1) {
    // Start from the most recent date and walk backwards
    let expectedDate = new Date(lastCheckInDate + "T00:00:00")
    for (const dateStr of dates) {
      const d = new Date(dateStr + "T00:00:00")
      const expected = expectedDate.toISOString().split("T")[0]
      if (dateStr === expected) {
        currentStreak++
        expectedDate.setDate(expectedDate.getDate() - 1)
      } else {
        break
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0
  let streak = 1
  const sortedAsc = [...dates].reverse() // oldest first
  for (let i = 1; i < sortedAsc.length; i++) {
    const prev = new Date(sortedAsc[i - 1] + "T00:00:00")
    const curr = new Date(sortedAsc[i] + "T00:00:00")
    const diff = (curr.getTime() - prev.getTime()) / 86400000
    if (diff === 1) {
      streak++
    } else {
      longestStreak = Math.max(longestStreak, streak)
      streak = 1
    }
  }
  longestStreak = Math.max(longestStreak, streak, currentStreak)

  return { currentStreak, longestStreak, lastCheckInDate, daysSinceLastCheckIn }
}

/**
 * Check if a user just hit a streak milestone and has no existing
 * auto-milestone for that value.
 */
export async function checkStreakMilestones(
  userId: string,
  coachId: string,
  currentStreak: number
): Promise<void> {
  const MILESTONES = [7, 14, 30, 60, 90]
  const hit = MILESTONES.find((m) => currentStreak === m)
  if (!hit) return

  // Check if this auto-milestone already exists
  const existing = await db.milestone.findFirst({
    where: {
      clientId: userId,
      type: "streak",
      targetValue: hit,
    },
  })

  if (existing) return

  // Create the milestone (achievedAt set, coach can add message later)
  await db.milestone.create({
    data: {
      coachId,
      clientId: userId,
      title: `${hit}-Day Streak`,
      description: `Checked in every day for ${hit} consecutive days`,
      type: "streak",
      targetValue: hit,
      achievedAt: new Date(),
    },
  })
}
