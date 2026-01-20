import { db } from "@/lib/db"

async function resolveMigration() {
  try {
    // Get all migrations from the _prisma_migrations table
    const migrations = await db.$queryRaw`
      SELECT * FROM "_prisma_migrations" 
      WHERE migration_name = '20260120_rename_perceived_effort_to_stress'
      ORDER BY started_at DESC
      LIMIT 1
    `

    console.log("Found migrations:", migrations)

    // If there's a failed migration, delete it so it can run again
    const result = await db.$executeRaw`
      DELETE FROM "_prisma_migrations" 
      WHERE migration_name = '20260120_rename_perceived_effort_to_stress'
      AND finished_at IS NULL
    `

    console.log(`Deleted ${result} failed migration(s)`)
    console.log("Migration has been reset. You can now run migrations again.")
  } catch (error) {
    console.error("Error resolving migration:", error)
    process.exit(1)
  } finally {
    await db.$disconnect()
  }
}

resolveMigration()
