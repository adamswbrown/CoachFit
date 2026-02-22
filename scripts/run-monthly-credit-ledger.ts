import { runMonthlyCreditTopupAndExpiry } from "../lib/classes-service"

function getArgValue(flag: string): string | undefined {
  const prefixed = process.argv.find((arg) => arg.startsWith(`${flag}=`))
  if (prefixed) {
    return prefixed.slice(flag.length + 1)
  }

  const index = process.argv.indexOf(flag)
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1]
  }

  return undefined
}

async function main() {
  const runAtRaw = getArgValue("--runAt")
  const runAt = runAtRaw ? new Date(runAtRaw) : new Date()

  if (Number.isNaN(runAt.getTime())) {
    throw new Error("Invalid --runAt date value")
  }

  console.log(`Running monthly credit job at ${runAt.toISOString()}...`)

  const result = await runMonthlyCreditTopupAndExpiry({ runAt })

  console.log("Done.")
  console.log(JSON.stringify({ runAt: runAt.toISOString(), ...result }, null, 2))
}

main()
  .catch((error) => {
    console.error("Monthly credit job failed:", error)
    process.exitCode = 1
  })
