import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function analyzeData() {
  // Get sample of clients with entry patterns
  const clients = await prisma.user.findMany({
    where: { roles: { has: "CLIENT" } },
    include: {
      Entry: {
        orderBy: { date: "desc" },
        take: 100,
      },
    },
    take: 50,
  })

  console.log("\n📊 CLIENT DATA ANALYSIS\n")
  console.log("Sample of 50 clients:\n")

  let totalClients = 0
  let clientsWithEntries = 0
  let activeClients = 0
  let totalEntries = 0

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const twoWeeksAgo = new Date(today)
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)

  for (const client of clients) {
    totalClients++
    if (client.Entry.length > 0) {
      clientsWithEntries++
      totalEntries += client.Entry.length

      const lastEntryDate = new Date(client.Entry[0].date)
      const isActive = lastEntryDate >= twoWeeksAgo
      if (isActive) activeClients++

      const daysSinceLastEntry = Math.floor(
        (today.getTime() - lastEntryDate.getTime()) / (1000 * 60 * 60 * 24)
      )
      const firstEntryDate = new Date(client.Entry[client.Entry.length - 1].date)
      const daySpan = Math.floor(
        (lastEntryDate.getTime() - firstEntryDate.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
      const consistency = daySpan > 0 ? ((client.Entry.length / daySpan) * 100).toFixed(1) : "N/A"

      console.log(
        `${client.name.padEnd(25)} | Entries: ${String(client.Entry.length).padStart(3)} | ` +
          `Span: ${String(daySpan).padStart(3)} days | Consistency: ${String(consistency).padStart(5)}% | ` +
          `Last: ${daysSinceLastEntry} days ago | Status: ${isActive ? "✓ Active" : "✗ Inactive"}`
      )
    } else {
      console.log(`${client.name.padEnd(25)} | NO ENTRIES`)
    }
  }

  console.log(`\n📈 SUMMARY:`)
  console.log(`   Sample clients analyzed: ${totalClients}`)
  console.log(`   Clients with entries: ${clientsWithEntries} (${((clientsWithEntries / totalClients) * 100).toFixed(1)}%)`)
  console.log(`   Clients active (< 2 weeks): ${activeClients} (${((activeClients / totalClients) * 100).toFixed(1)}%)`)
  console.log(`   Total entries in sample: ${totalEntries}`)

  // Get distribution stats
  const allClients = await prisma.user.count({
    where: { roles: { has: "CLIENT" } },
  })
  const allEntries = await prisma.entry.count()

  console.log(`\n📊 FULL DATABASE:`)
  console.log(`   Total clients: ${allClients}`)
  console.log(`   Total entries: ${allEntries}`)
  console.log(`   Avg entries per client: ${(allEntries / allClients).toFixed(1)}`)
}

analyzeData()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
