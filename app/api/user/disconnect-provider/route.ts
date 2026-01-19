import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { provider } = await request.json()

    if (!provider) {
      return NextResponse.json(
        { error: "Provider is required" },
        { status: 400 }
      )
    }

    // Check if user has other auth methods available
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        passwordHash: true,
        Account: {
          select: { provider: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Count remaining auth methods after disconnection
    const otherAccounts = user.Account.filter((a) => a.provider !== provider)
    const hasPassword = !!user.passwordHash
    const totalAuthMethods =
      otherAccounts.length + (hasPassword ? 1 : 0)

    // Don't allow disconnecting if it's the only auth method
    if (totalAuthMethods === 0) {
      return NextResponse.json(
        {
          error:
            "Cannot disconnect your only login method. Please set a password first or add another provider.",
        },
        { status: 400 }
      )
    }

    // Delete the OAuth account
    await db.account.deleteMany({
      where: {
        userId: session.user.id,
        provider: provider,
      },
    })

    return NextResponse.json({
      success: true,
      message: `${provider} account disconnected successfully`,
    })
  } catch (error) {
    console.error("Error disconnecting provider:", error)
    return NextResponse.json(
      { error: "Failed to disconnect account" },
      { status: 500 }
    )
  }
}
