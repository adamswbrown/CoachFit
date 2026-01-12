import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const email = process.argv[2]

  if (!email) {
    console.error('Usage: npx tsx scripts/complete-onboarding.ts <email>')
    process.exit(1)
  }

  try {
    const user = await db.user.update({
      where: { email },
      data: { onboardingComplete: true },
      select: {
        id: true,
        email: true,
        name: true,
        roles: true,
        onboardingComplete: true,
      },
    })

    console.log('✅ Onboarding completed for user:')
    console.log(JSON.stringify(user, null, 2))
  } catch (error: any) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

main()
