import { PrismaClient, Role } from "@prisma/client"

const db = new PrismaClient()

async function addCoachToAdmins() {
  try {
    // Find all users with ADMIN role
    const adminUsers = await db.user.findMany({
      where: {
        roles: {
          has: Role.ADMIN
        }
      }
    })

    console.log(`Found ${adminUsers.length} admin user(s)`)

    // Add COACH role to each admin if they don't have it
    for (const user of adminUsers) {
      if (!user.roles.includes(Role.COACH)) {
        await db.user.update({
          where: { id: user.id },
          data: {
            roles: [...user.roles, Role.COACH]
          }
        })
        console.log(`✓ Added COACH role to ${user.email}`)
      } else {
        console.log(`  ${user.email} already has COACH role`)
      }
    }

    console.log("\nDone!")
  } catch (error) {
    console.error("Error:", error)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

addCoachToAdmins()
