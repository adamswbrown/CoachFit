import { db } from '../lib/db'

async function main() {
  const user = await db.user.findFirst({
    where: {
      OR: [
        { name: { contains: 'Benjamin King', mode: 'insensitive' } },
        { email: { contains: 'client160', mode: 'insensitive' } }
      ]
    }
  })

  if (!user) {
    console.log('User not found')
    return
  }

  console.log('User:', user.email, '-', user.name)
  console.log('User ID:', user.id)

  const entries = await db.entry.findMany({
    where: { userId: user.id },
    select: {
      date: true,
      dataSources: true,
      weightLbs: true,
      steps: true,
      calories: true
    },
    orderBy: { date: 'desc' },
    take: 10
  })

  console.log('\nTotal entries:', await db.entry.count({ where: { userId: user.id } }))
  
  const healthkitCount = await db.entry.count({
    where: {
      userId: user.id,
      dataSources: { array_contains: 'healthkit' }
    }
  })
  console.log('HealthKit entries:', healthkitCount)

  console.log('\nRecent entries:')
  entries.forEach(e => {
    const dateStr = e.date.toISOString().split('T')[0]
    let sources = 'none'
    if (Array.isArray(e.dataSources)) {
      sources = e.dataSources.every(item => typeof item === 'string')
        ? e.dataSources.join(', ')
        : JSON.stringify(e.dataSources)
    }
    console.log(`  ${dateStr}: ${sources} - weight: ${e.weightLbs || '—'}, steps: ${e.steps || '—'}`)
  })
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
