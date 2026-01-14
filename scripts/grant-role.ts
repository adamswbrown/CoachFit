import { PrismaClient, Role } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2]
  const roleName = process.argv[3]?.toUpperCase() || "ADMIN"

  if (!email) {
    console.error("❌ Usage: npm run grant-role <email> [ADMIN|COACH|CLIENT]")
    process.exit(1)
  }

  // Validate role
  const validRoles = ["ADMIN", "COACH", "CLIENT"]
  if (!validRoles.includes(roleName)) {
    console.error(`❌ Invalid role: ${roleName}. Must be one of: ${validRoles.join(", ")}`)
    process.exit(1)
  }

  console.log(`Granting ${roleName} role to ${email}...`)

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      roles: [roleName as Role],
    },
    create: {
      email,
      name: email.split("@")[0], // Use part of email as default name
      roles: [roleName as Role],
    },
  })

  console.log(`✅ Successfully granted ${roleName} role to ${user.email} (${user.name})`)
  console.log(`   Roles: ${user.roles.join(", ")}`)
  console.log(`\n📝 Note: User needs a password to login. Set with:`)
  console.log(`   npm run password:set ${user.email} <password>`)
}

main()
  .catch((e) => {
    console.error("❌ Error granting role:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
