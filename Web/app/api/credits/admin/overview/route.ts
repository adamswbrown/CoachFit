import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"
import { db } from "@/lib/db"
import { isAdmin } from "@/lib/permissions"
import { CreditSubmissionStatus } from "@prisma/client"

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!isAdmin(session.user)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Fetch all aggregate stats in parallel
    const [
      creditAccounts,
      pendingSubmissionsCount,
      totalTransactionsLast30Days,
      rawTransactions,
      totalClientsWithAccounts,
      products,
    ] = await Promise.all([
      // Sum of all balances
      db.clientCreditAccount.findMany({
        select: { balance: true },
      }),
      // Count of pending submissions
      db.creditSubmission.count({
        where: { status: CreditSubmissionStatus.PENDING },
      }),
      // Transactions in last 30 days
      db.clientCreditLedger.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      // Last 20 ledger entries with client relation
      db.clientCreditLedger.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: { id: true, name: true, email: true },
          },
          creditProduct: {
            select: { id: true, name: true },
          },
        },
      }),
      // Total clients with credit accounts
      db.clientCreditAccount.count(),
      // All credit products (for products overview)
      db.creditProduct.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          ownerCoach: {
            select: { id: true, name: true, email: true },
          },
        },
      }),
    ])

    const totalCreditsInCirculation = creditAccounts.reduce(
      (sum, account) => sum + account.balance,
      0
    )

    // Map transactions to the flat shape the frontend expects
    const recentTransactions = rawTransactions.map((entry) => ({
      id: entry.id,
      createdAt: entry.createdAt.toISOString(),
      deltaCredits: entry.deltaCredits,
      reason: entry.reason,
      description: entry.creditProduct?.name ?? null,
      clientName: entry.client.name,
      clientEmail: entry.client.email,
    }))

    // Map products to flat shape
    const mappedProducts = products.map((p) => ({
      id: p.id,
      name: p.name,
      purchasePriceGbp: p.purchasePriceGbp,
      creditsPerPeriod: p.creditsPerPeriod,
      isActive: p.isActive,
      purchasableByProviderOnly: p.purchasableByProviderOnly,
      ownerCoachId: p.ownerCoachId ?? "",
      ownerCoachName: p.ownerCoach?.name ?? null,
      ownerCoachEmail: p.ownerCoach?.email ?? "",
    }))

    return NextResponse.json(
      {
        stats: {
          totalCreditsInCirculation,
          pendingSubmissionsCount,
          totalTransactionsLast30Days,
          totalClientsWithAccounts,
        },
        recentTransactions,
        products: mappedProducts,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error("Error fetching admin credits overview:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
