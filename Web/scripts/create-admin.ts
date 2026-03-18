import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function main() {
  const email = "adamswbrown@gmail.com"
  
  // Check if admin exists
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`✅ Admin already exists: ${email}`)
    await db.$disconnect()
    return
  }
  
  // Create admin user
  const passwordHash = await bcrypt.hash("admin123", 10)
  const admin = await db.user.create({
    data: {
      email,
      name: "Admin User",
      passwordHash,
      roles: ["ADMIN"],
      onboardingComplete: true,
    },
  })
  
  console.log(`✅ Admin user created: ${admin.email}`)
  await db.$disconnect()
}

main()
