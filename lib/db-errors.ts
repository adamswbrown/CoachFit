export function isSchemaNotReadyError(error: unknown): boolean {
  const err = error as { code?: string; message?: string }
  const message = (err?.message || "").toLowerCase()

  if (err?.code === "P2021" || err?.code === "P2022") {
    return true
  }

  if (message.includes("does not exist") && message.includes("relation")) {
    return true
  }

  if (message.includes("does not exist") && message.includes("column")) {
    return true
  }

  if (message.includes("the table") && message.includes("does not exist")) {
    return true
  }

  return false
}

export function isInteractiveTransactionNotFoundError(error: unknown): boolean {
  const err = error as { code?: string; message?: string }
  const message = (err?.message || "").toLowerCase()
  return err?.code === "P2028" || message.includes("transaction not found")
}
