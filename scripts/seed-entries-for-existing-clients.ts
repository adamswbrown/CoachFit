import { PrismaClient, Role } from "@prisma/client"

const db = new PrismaClient()

// Generate random entry data (simple version)
function generateEntryData() {
  const weight = 140 + Math.random() * 60
  const steps = 4000 + Math.floor(Math.random() * 8000)
  const calories = 1600 + Math.floor(Math.random() * 1200)
  const sleepQuality = Math.floor(Math.random() * 10) + 1
  const perceivedStress = Math.floor(Math.random() * 10) + 1
  return { weight, steps, calories, sleepQuality, perceivedStress }
}

async function main() {
  const clients = await db.user.findMany({
    where: { roles: { has: Role.CLIENT } },
    select: { id: true },
  })
  if (clients.length === 0) {
    console.log("No clients found.")
    return
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let totalEntries = 0
  for (const client of clients) {
    const entryDates: Date[] = []
    for (let i = 0; i < 28; i++) {
      if (Math.random() < 0.8) { // 80% consistency
        const entryDate = new Date(today)
        entryDate.setDate(entryDate.getDate() - i)
        entryDates.push(entryDate)
      }
    }
    for (const entryDate of entryDates) {
      const entryData = generateEntryData()
      await db.entry.upsert({
        where: {
          userId_date: {
            userId: client.id,
            date: entryDate,
          },
        },
        update: {
          weightLbs: entryData.weight,
          steps: entryData.steps,
          calories: entryData.calories,
          sleepQuality: entryData.sleepQuality,
          perceivedStress: entryData.perceivedStress,
          dataSources: ["script"],
        },
        create: {
          userId: client.id,
          date: entryDate,
          weightLbs: entryData.weight,
          steps: entryData.steps,
          calories: entryData.calories,
          sleepQuality: entryData.sleepQuality,
          perceivedStress: entryData.perceivedStress,
          dataSources: ["script"],
        },
      })
      totalEntries++
    }
  }
  console.log(`Seeded ${totalEntries} entries for ${clients.length} clients.`)
}

main().then(() => db.$disconnect())
