import { PrismaClient, Role } from "@prisma/client"
import { randomUUID } from "crypto"

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding test users for development...")

  // Seed test users for local development
  // Note: Users created by this script don't have passwords set
  // Use `npm run password:set <email> <password>` to set passwords for test users

  await prisma.user.upsert({
    where: { email: "coach@test.local" },
    update: {
      roles: [Role.COACH],
      isTestUser: true,
    },
    create: {
      id: randomUUID(),
      email: "coach@test.local",
      name: "Test Coach",
      roles: [Role.COACH],
      isTestUser: true,
    },
  })

  await prisma.user.upsert({
    where: { email: "client@test.local" },
    update: {
      roles: [Role.CLIENT],
      isTestUser: true,
    },
    create: {
      id: randomUUID(),
      email: "client@test.local",
      name: "Test Client",
      roles: [Role.CLIENT],
      isTestUser: true,
    },
  })

  // Unassigned user for testing "not assigned to coach" flow
  // Use noinvite@test.local to test user with no pending invites
  await prisma.user.upsert({
    where: { email: "noinvite@test.local" },
    update: {
      roles: [Role.CLIENT],
      isTestUser: true,
    },
    create: {
      id: randomUUID(),
      email: "noinvite@test.local",
      name: "No Invite Client",
      roles: [Role.CLIENT],
      isTestUser: true,
    },
  })

  // User with pending invite for auto-assignment testing
  await prisma.user.upsert({
    where: { email: "unassigned@test.local" },
    update: {
      roles: [Role.CLIENT],
      isTestUser: true,
    },
    create: {
      id: randomUUID(),
      email: "unassigned@test.local",
      name: "Unassigned Client",
      roles: [Role.CLIENT],
      isTestUser: true,
    },
  })

  console.log("✅ Test users seeded successfully!")
  console.log("   - coach@test.local (COACH role)")
  console.log("   - client@test.local (CLIENT role)")
  console.log("   - noinvite@test.local (CLIENT role, no cohort)")
  console.log("   - unassigned@test.local (CLIENT role, has pending invite)")
  console.log("\n⚠️  Note: These users don't have passwords set.")
  console.log("   Use 'npm run password:set <email> <password>' to set passwords.")
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
