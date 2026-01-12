import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // Get email and password from command line arguments
  const email = process.argv[2]
  const password = process.argv[3]

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/set-password.ts <email> <password>")
    console.error("\nExample:")
    console.error("  npx tsx scripts/set-password.ts coach@test.local MyNewPassword123")
    process.exit(1)
  }

  // Validate email format
  if (!email.includes("@")) {
    console.error("Error: Invalid email format")
    process.exit(1)
  }

  // Validate password length
  if (password.length < 6) {
    console.error("Error: Password must be at least 6 characters long")
    process.exit(1)
  }

  console.log(`Setting password for ${email}...`)

  // Check if user exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      name: true,
      passwordHash: true,
      isTestUser: true,
    },
  })

  if (!existingUser) {
    console.error(`Error: User with email ${email} not found`)
    console.error("\nTo create a new user, use the signup page or seed script.")
    process.exit(1)
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10)

  // Update user password
  const user = await prisma.user.update({
    where: { email },
    data: { passwordHash },
    select: {
      id: true,
      email: true,
      name: true,
      isTestUser: true,
    },
  })

  console.log(`✅ Successfully set password for ${user.email}`)
  console.log(`   Name: ${user.name || "N/A"}`)
  console.log(`   Test User: ${user.isTestUser ? "Yes" : "No"}`)
  console.log(`\n📝 Login with:`)
  console.log(`   Email: ${email}`)
  console.log(`   Password: ${password}`)
}

main()
  .catch((e) => {
    console.error("Error setting password:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
