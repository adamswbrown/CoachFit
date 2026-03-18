import { db } from '../lib/db'

async function main() {
  // Get all users who have entries with healthkit dataSources
  const usersWithHealthKit = await db.user.findMany({
    where: {
      Entry: {
        some: {
          dataSources: { array_contains: 'healthkit' }
        }
      }
    },
    select: {
      id: true,
      email: true,
      name: true,
      isTestUser: true,
      ClientPairingCodes: {
        where: {
          usedAt: { not: null }
        },
        select: {
          code: true,
          usedAt: true
        }
      }
    }
  })

  console.log(`\n📊 Users with HealthKit entries: ${usersWithHealthKit.length}\n`)
  
  if (usersWithHealthKit.length === 0) {
    console.log('✅ No users found with HealthKit entries that lack proper pairing!')
    console.log('All data is consistent.\n')
    return
  }

  let issuesFound = 0

  for (const user of usersWithHealthKit) {
    const paired = user.ClientPairingCodes.length > 0
    
    const healthkitCount = await db.entry.count({
      where: {
        userId: user.id,
        dataSources: { array_contains: 'healthkit' }
      }
    })

    console.log(`${user.email} (${user.name || 'no name'})`)
    console.log(`  Test User: ${user.isTestUser ? 'Yes' : 'No'}`)
    console.log(`  Paired: ${paired ? 'YES ✓' : 'NO ✗'}`)
    console.log(`  HealthKit entries: ${healthkitCount}`)

    if (!paired && healthkitCount > 0) {
      console.log(`  ⚠️  WARNING: Has HealthKit entries but device not paired!`)
      issuesFound++
    }

    console.log('')
  }

  if (issuesFound > 0) {
    console.log(`\n❌ Found ${issuesFound} user(s) with HealthKit data but no paired device\n`)
  } else {
    console.log(`\n✅ All users with HealthKit entries have properly paired devices\n`)
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
