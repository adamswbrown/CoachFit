import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

async function main() {
  // Create a test coach
  const coachPassword = await bcrypt.hash("password123", 10)
  try {
    const coach = await db.user.create({
      data: {
        email: "coach@test.local",
        name: "Test Coach",
        passwordHash: coachPassword,
        roles: ["COACH"],
      },
    })
    console.log("✅ Coach created: coach@test.local / password123")
  } catch (e: any) {
    if (e.code === "P2002") {
      console.log("⚠️  Coach already exists")
    } else {
      throw e
    }
  }

  // Create a test client
  const clientPassword = await bcrypt.hash("password123", 10)
  try {
    const client = await db.user.create({
      data: {
        email: "client@test.local",
        name: "Test Client",
        passwordHash: clientPassword,
        roles: ["CLIENT"],
      },
    })
    console.log("✅ Client created: client@test.local / password123")
  } catch (e: any) {
    if (e.code === "P2002") {
      console.log("⚠️  Client already exists")
    } else {
      throw e
    }
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect())
