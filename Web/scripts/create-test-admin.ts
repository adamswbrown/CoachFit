import { PrismaClient, Role } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  // Default test admin credentials
  const email = process.argv[2] || "admin@test.local"
  const password = process.argv[3] || "admin123"
  const name = process.argv[4] || "Test Admin"

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

  console.log(`Creating test admin user: ${email}...`)

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10)

  // Create or update user with ADMIN role and password
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      roles: [Role.ADMIN],
      name: name,
      passwordHash: passwordHash,
      isTestUser: true,
    },
    create: {
      email,
      name: name,
      roles: [Role.ADMIN],
      passwordHash: passwordHash,
      isTestUser: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      roles: true,
      isTestUser: true,
      passwordHash: true,
    },
  })

  console.log(`✅ Successfully created test admin user!`)
  console.log(`   Email: ${user.email}`)
  console.log(`   Name: ${user.name}`)
  console.log(`   Roles: ${user.roles.join(", ")}`)
  console.log(`   Test User: ${user.isTestUser ? "Yes" : "No"}`)
  console.log(`   Password: ${password}`)
  console.log(`\n📝 Login credentials:`)
  console.log(`   Email: ${email}`)
  console.log(`   Password: ${password}`)
  console.log(`\n💡 You can now login at: ${process.env.NEXTAUTH_URL || "http://localhost:3000"}/login`)
}

main()
  .catch((e) => {
    console.error("Error creating test admin:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })