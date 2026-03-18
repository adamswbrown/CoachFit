export function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function getNextExpectedCheckInDate(
  lastCheckInDate: Date | null,
  frequencyDays: number,
  now: Date = new Date()
): Date {
  if (!lastCheckInDate) {
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    return today
  }
  return addDays(lastCheckInDate, frequencyDays)
}

export function isCheckInMissed(nextExpectedDate: Date, now: Date = new Date()): boolean {
  const endOfDay = new Date(nextExpectedDate)
  endOfDay.setHours(23, 59, 59, 999)
  return now.getTime() > endOfDay.getTime()
}
