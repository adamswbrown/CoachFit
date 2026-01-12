import { db } from "../lib/db"

async function cleanupOrphanedUser() {
  const email = "adamswbrown@gmail.com"
  
  // Find the user
  const user = await db.user.findUnique({
    where: { email },
    include: { Account: true },
  })

  if (!user) {
    console.log(`User with email ${email} not found`)
    return
  }

  console.log(`Found user: ${user.id} (${user.email})`)
  console.log(`Accounts linked: ${user.Account.length}`)

  if (user.Account.length === 0) {
    // Delete the orphaned user
    await db.user.delete({
      where: { id: user.id },
    })
    console.log(`Deleted orphaned user: ${user.email}`)
  } else {
    console.log(`User has ${user.Account.length} account(s), not deleting`)
  }
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
