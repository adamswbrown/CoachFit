import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()

async function main() {
  const users = await db.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      roles: true,
      passwordHash: true,
    },
    orderBy: { email: "asc" },
  })

  console.log(`\n📋 Total users in database: ${users.length}\n`)

  if (users.length === 0) {
    console.log("❌ No users found!")
    return
  }

  console.log("Users:")
  console.log("─".repeat(80))

  users.forEach((user) => {
    const hasPassword = user.passwordHash ? "✅" : "❌"
    console.log(
      `${hasPassword} ${user.email.padEnd(30)} | ${user.name} | Roles: ${user.roles.join(", ")}`
    )
  })

  console.log("─".repeat(80))

  // Check for specific users
  console.log("\n🔍 Checking for specific users:")
  const lookingFor = ["alex.thompson@test.local", "coach@test.local", "admin@test.local"]
  lookingFor.forEach((email) => {
    const user = users.find((u) => u.email === email)
    if (user) {
      console.log(`✅ ${email} exists (${user.roles.join(", ")})`)
    } else {
      console.log(`❌ ${email} NOT FOUND`)
    }
  })
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
