import { db } from "../lib/db"

async function cleanupOrphanedUser() {
  const email = "adamswbrown@gmail.com"

  // Find the user
  // Note: OAuth accounts are now managed by Clerk externally
  const user = await db.user.findUnique({
    where: { email },
  })

  if (!user) {
    console.log(`User with email ${email} not found`)
    return
  }

  console.log(`Found user: ${user.id} (${user.email})`)

  // Delete the orphaned user
  await db.user.delete({
    where: { id: user.id },
  })
  console.log(`Deleted orphaned user: ${user.email}`)
}

cleanupOrphanedUser()
  .then(() => {
    console.log("Cleanup complete")
    process.exit(0)
  })
  .catch((error) => {
    console.error("Error:", error)
    process.exit(1)
  })
