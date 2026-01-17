/**
 * Generate an email draft for weekly coach review.
 * This is a copy-only template (not sent automatically).
 */

interface WeeklyStats {
  checkInCount: number
  checkInRate: number
  avgWeight: number | null
  weightTrend: number | null
  avgSteps: number | null
  avgCalories: number | null
  avgSleepMins: number | null
}

interface EmailDraftOptions {
  clientName: string | null
  weekStart: string
  stats: WeeklyStats
  loomUrl?: string | null
}

export function generateWeeklyEmailDraft(options: EmailDraftOptions): string {
  const { clientName, weekStart, stats, loomUrl } = options

  const name = clientName || "there"
  const checkInPercentage = Math.round(stats.checkInRate * 100)

  let emailBody = `Subject: Weekly Check-In Summary – Week of ${weekStart}\n\n`
  emailBody += `Hey ${name},\n\n`
  emailBody += `Here's your weekly summary:\n\n`

  // Check-ins
  emailBody += `• Check-ins: ${stats.checkInCount}/7 (${checkInPercentage}%)\n`

  // Weight stats
  if (stats.avgWeight !== null) {
    emailBody += `• Avg weight: ${stats.avgWeight.toFixed(1)} lbs`
    if (stats.weightTrend !== null) {
      const trendSign = stats.weightTrend > 0 ? "+" : ""
      emailBody += ` (${trendSign}${stats.weightTrend.toFixed(1)} lbs this week)`
    }
    emailBody += `\n`
  }

  // Steps
  if (stats.avgSteps !== null) {
    emailBody += `• Avg steps: ${stats.avgSteps.toLocaleString()}\n`
  }

  // Calories
  if (stats.avgCalories !== null) {
    emailBody += `• Avg calories: ${stats.avgCalories.toLocaleString()}\n`
  }

  // Sleep
  if (stats.avgSleepMins !== null) {
    const hours = Math.floor(stats.avgSleepMins / 60)
    const mins = stats.avgSleepMins % 60
    emailBody += `• Avg sleep: ${hours}h ${mins}m\n`
  }

  emailBody += `\n`

  // Loom link
  if (loomUrl) {
    emailBody += `I recorded a Loom update for you here:\n${loomUrl}\n\n`
  } else {
    emailBody += `[Add your Loom video link here]\n\n`
  }

  emailBody += `Let me know if you have any questions for next week!\n\n`
  emailBody += `Best,\n[Your Name]`

  return emailBody
}
