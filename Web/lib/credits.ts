import { db } from "@/lib/db"
import { CreditLedgerReason, CreditSubmissionStatus } from "@prisma/client"
import type { Prisma } from "@prisma/client"

export type CreditMetadata = {
  bookingId?: string
  submissionId?: string
  creditProductId?: string
  subscriptionId?: string
  createdByUserId?: string
}

/**
 * Get the current credit balance for a client.
 * Returns 0 if no account exists yet.
 */
export async function getBalance(clientId: string): Promise<number> {
  const account = await db.clientCreditAccount.findUnique({
    where: { clientId },
    select: { balance: true },
  })
  return account?.balance ?? 0
}

/**
 * Ensure a ClientCreditAccount exists for the given client.
 * Uses upsert so it is safe to call within any transaction.
 */
export async function ensureCreditAccount(
  tx: Prisma.TransactionClient,
  clientId: string
): Promise<void> {
  await tx.clientCreditAccount.upsert({
    where: { clientId },
    update: {},
    create: { clientId, balance: 0 },
  })
}

/**
 * Debit credits from a client's account.
 * Throws an error if the client has insufficient balance.
 * All operations run inside a transaction.
 */
export async function debitCredits(
  clientId: string,
  amount: number,
  reason: CreditLedgerReason,
  metadata: CreditMetadata = {}
): Promise<void> {
  if (amount <= 0) throw new Error("Debit amount must be positive")

  await db.$transaction(async (tx) => {
    await ensureCreditAccount(tx, clientId)

    // ATOMIC: conditional update prevents race condition — two concurrent debits
    // cannot both pass the balance check because updateMany with WHERE balance >= amount
    // is atomic at the database level.
    const result = await tx.clientCreditAccount.updateMany({
      where: {
        clientId,
        balance: { gte: amount },
      },
      data: { balance: { decrement: amount } },
    })

    if (result.count === 0) {
      const account = await tx.clientCreditAccount.findUnique({
        where: { clientId },
        select: { balance: true },
      })
      throw new Error(
        `Insufficient credits: balance ${account?.balance ?? 0}, requested ${amount}`
      )
    }

    await tx.clientCreditLedger.create({
      data: {
        clientId,
        deltaCredits: -amount,
        reason,
        bookingId: metadata.bookingId ?? null,
        submissionId: metadata.submissionId ?? null,
        creditProductId: metadata.creditProductId ?? null,
        subscriptionId: metadata.subscriptionId ?? null,
        createdByUserId: metadata.createdByUserId ?? null,
      },
    })
  })
}

/**
 * Add credits to a client's account (top-up).
 * Creates the account if it doesn't exist.
 * All operations run inside a transaction.
 */
export async function creditTopup(
  clientId: string,
  amount: number,
  reason: CreditLedgerReason,
  metadata: CreditMetadata = {}
): Promise<void> {
  if (amount <= 0) throw new Error("Topup amount must be positive")

  await db.$transaction(async (tx) => {
    await ensureCreditAccount(tx, clientId)

    await tx.clientCreditLedger.create({
      data: {
        clientId,
        deltaCredits: amount,
        reason,
        bookingId: metadata.bookingId ?? null,
        submissionId: metadata.submissionId ?? null,
        creditProductId: metadata.creditProductId ?? null,
        subscriptionId: metadata.subscriptionId ?? null,
        createdByUserId: metadata.createdByUserId ?? null,
      },
    })

    await tx.clientCreditAccount.update({
      where: { clientId },
      data: { balance: { increment: amount } },
    })
  })
}

/**
 * Refund credits to a client after a booking cancellation.
 * Convenience wrapper around creditTopup with REFUND reason.
 */
export async function refundCredits(
  clientId: string,
  amount: number,
  bookingId: string
): Promise<void> {
  await creditTopup(clientId, amount, CreditLedgerReason.REFUND, { bookingId })
}

/**
 * Process an APPROVE or REJECT action on a CreditSubmission.
 * If approved, credits are added to the client's account and the submission
 * is linked to the ledger entry. All ops run inside a transaction.
 */
export async function processSubmission(
  submissionId: string,
  action: "APPROVE" | "REJECT",
  reviewerId: string,
  paymentMeta?: { paidAt?: Date; paymentMethod?: string }
): Promise<void> {
  await db.$transaction(async (tx) => {
    const submission = await tx.creditSubmission.findUnique({
      where: { id: submissionId },
      include: { creditProduct: true },
    })

    if (!submission) {
      throw new Error(`CreditSubmission not found: ${submissionId}`)
    }

    if (submission.status !== CreditSubmissionStatus.PENDING) {
      // Already processed — idempotent: skip silently
      return
    }

    const newStatus =
      action === "APPROVE"
        ? CreditSubmissionStatus.APPROVED
        : CreditSubmissionStatus.REJECTED

    const updateData: Record<string, unknown> = {
      status: newStatus,
      reviewedByUserId: reviewerId,
      reviewedAt: new Date(),
    }
    // Include payment metadata inside the same transaction (atomicity fix)
    if (paymentMeta?.paidAt) updateData.paidAt = paymentMeta.paidAt
    if (paymentMeta?.paymentMethod) updateData.paymentMethod = paymentMeta.paymentMethod

    await tx.creditSubmission.update({
      where: { id: submissionId },
      data: updateData,
    })

    if (action === "APPROVE") {
      const credits = submission.creditProduct.creditsPerPeriod ?? 0
      if (credits <= 0) {
        throw new Error(
          `Product "${submission.creditProduct.name}" has no credits configured`
        )
      }

      await ensureCreditAccount(tx, submission.clientId)

      await tx.clientCreditLedger.create({
        data: {
          clientId: submission.clientId,
          deltaCredits: credits,
          reason: CreditLedgerReason.PACK_PURCHASE,
          submissionId,
          creditProductId: submission.creditProductId,
          createdByUserId: reviewerId,
        },
      })

      await tx.clientCreditAccount.update({
        where: { clientId: submission.clientId },
        data: { balance: { increment: credits } },
      })
    }
  })
}

/**
 * Manual credit adjustment by a coach or admin.
 * Amount can be positive (add) or negative (deduct).
 * For negative adjustments, balance sufficiency is enforced.
 */
export async function adjustCredits(
  clientId: string,
  amount: number,
  reason: string,
  createdByUserId: string
): Promise<void> {
  if (amount === 0) throw new Error("Adjustment amount must be non-zero")

  await db.$transaction(async (tx) => {
    await ensureCreditAccount(tx, clientId)

    if (amount < 0) {
      // ATOMIC: conditional update prevents race condition on negative adjustments
      const result = await tx.clientCreditAccount.updateMany({
        where: {
          clientId,
          balance: { gte: Math.abs(amount) },
        },
        data: { balance: { decrement: Math.abs(amount) } },
      })
      if (result.count === 0) {
        const account = await tx.clientCreditAccount.findUnique({
          where: { clientId },
          select: { balance: true },
        })
        throw new Error(
          `Insufficient credits for adjustment: balance ${account?.balance ?? 0}, requested deduction ${Math.abs(amount)}`
        )
      }
    } else {
      await tx.clientCreditAccount.update({
        where: { clientId },
        data: { balance: { increment: amount } },
      })
    }

    await tx.clientCreditLedger.create({
      data: {
        clientId,
        deltaCredits: amount,
        reason: CreditLedgerReason.MANUAL_ADJUSTMENT,
        createdByUserId,
      },
    })
  })
}
