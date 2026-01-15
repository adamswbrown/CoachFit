import { PrismaClient, Role } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const email = "adamswbrown@gmail.com"
  const name = "Adam Brown"

  console.log(`Setting ${email} as ADMIN...`)

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      roles: [Role.ADMIN],
      name: name,
    },
    create: {
      email,
      name: name,
      roles: [Role.ADMIN],
    },
  })

  console.log(`✅ Successfully set ${user.email} (${user.name}) as ADMIN`)
  console.log(`   Roles: ${user.roles.join(", ")}`)
}

main()
  .catch((e) => {
    console.error("Error setting admin:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
