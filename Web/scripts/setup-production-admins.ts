import { PrismaClient, Role } from "@prisma/client"
import { randomUUID } from "crypto"

const prisma = new PrismaClient()

// Production administrators to create
const PRODUCTION_ADMINS = [
  { email: "adamvbrown@gmail.com", name: "Adam Brown" },
  { email: "coachgav@gcgyms.com", name: "Gav" },
  { email: "victoria.denstedt@gmail.com", name: "Vic" },
]

async function main() {
  console.log("Setting up production administrators...\n")

  for (const admin of PRODUCTION_ADMINS) {
    const user = await prisma.user.upsert({
      where: { email: admin.email },
      update: {
        roles: [Role.ADMIN, Role.COACH], // Admins get both roles
        isTestUser: false,
        onboardingComplete: true,
      },
      create: {
        id: randomUUID(),
        email: admin.email,
        name: admin.name,
        roles: [Role.ADMIN, Role.COACH],
        isTestUser: false,
        onboardingComplete: true,
      },
    })

    console.log(`  ✅ ${admin.email} - ${user.id}`)
  }

  console.log("\n✅ Production administrators created successfully!")
  console.log("\n⚠️  Note: These users don't have passwords set yet.")
  console.log("   Use 'npm run password:set <email> <password>' to set passwords.")
  console.log("   Or they can use Google/Apple sign-in if configured.")
}

main()
  .catch((e) => {
    console.error("Error setting up admins:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
