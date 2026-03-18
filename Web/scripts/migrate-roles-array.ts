import { PrismaClient, Role } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🔄 Migrating users from single role to roles array...")

  // First, add the roles column if it doesn't exist (handled by schema, but we'll verify)
  // Then migrate existing data

  // Get all users with the old role field
  // Note: We need to use raw SQL since Prisma schema has changed
  const users = await prisma.$queryRaw<Array<{ id: string; role: string }>>`
    SELECT id, role::text
    FROM "User"
    WHERE role IS NOT NULL
  `

  console.log(`Found ${users.length} users to migrate`)

  for (const user of users) {
    // Convert old role to roles array
    let roles: Role[] = []
    
    if (user.role === "CLIENT") {
      roles = [Role.CLIENT]
    } else if (user.role === "COACH") {
      roles = [Role.COACH]
    } else {
      // Default to CLIENT if unknown
      roles = [Role.CLIENT]
    }

    // Update user with roles array
    await prisma.user.update({
      where: { id: user.id },
      data: { roles },
    })

    console.log(`  ✓ Migrated user ${user.id}: ${user.role} → [${roles.join(", ")}]`)
  }

  console.log(`\n✅ Migration complete! Migrated ${users.length} users.`)
}

main()
  .catch((e) => {
    console.error("❌ Error migrating roles:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
