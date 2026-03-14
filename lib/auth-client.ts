"use client"

import { createAuthClient } from "better-auth/react"
import { customSessionClient } from "better-auth/client/plugins"
import type { auth } from "./auth"
import type { Role } from "./types"

export const authClient = createAuthClient({
  plugins: [customSessionClient<typeof auth>()],
})

// Re-export direct client functions
export const {
  signIn: betterAuthSignIn,
  signUp,
  signOut: betterAuthSignOut,
  useSession: betterAuthUseSession,
} = authClient

/**
 * Compatibility wrapper for useSession that returns the same shape
 * as the old NextAuth useSession() hook.
 *
 * Returns { data: session, status: "loading" | "authenticated" | "unauthenticated" }
 */
export function useSession() {
  const { data, isPending, error } = betterAuthUseSession()

  const status = isPending
    ? "loading" as const
    : data?.session
      ? "authenticated" as const
      : "unauthenticated" as const

  // Map Better Auth session to the shape components expect
  const session = data?.session && data?.user
    ? {
        user: {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name ?? null,
          image: data.user.image ?? null,
          roles: ((data.user as any).roles as Role[]) ?? (["CLIENT"] as Role[]),
          isTestUser: (data.user as any).isTestUser ?? false,
          mustChangePassword: (data.user as any).mustChangePassword ?? false,
          onboardingComplete: (data.user as any).onboardingComplete ?? false,
        },
      }
    : null

  return { data: session, status }
}

/**
 * Sign in with email and password.
 * Compatible with the old NextAuth signIn("credentials", { ... }) pattern.
 */
export async function signIn(
  provider: string,
  options?: {
    email?: string
    password?: string
    callbackUrl?: string
    redirect?: boolean
  }
) {
  if (provider === "credentials" || provider === "email") {
    const result = await betterAuthSignIn.email({
      email: options?.email ?? "",
      password: options?.password ?? "",
    })

    if (result.error) {
      return { error: result.error.message || "Sign in failed", ok: false }
    }

    return { error: null, ok: true }
  }

  if (provider === "google") {
    await betterAuthSignIn.social({
      provider: "google",
      callbackURL: options?.callbackUrl || "/dashboard",
    })
    return { error: null, ok: true }
  }

  return { error: "Unknown provider", ok: false }
}

/**
 * Sign out. Compatible with old NextAuth signOut({ callbackUrl }) pattern.
 */
export async function signOut(options?: { callbackUrl?: string }) {
  await betterAuthSignOut({
    fetchOptions: {
      onSuccess: () => {
        if (options?.callbackUrl) {
          window.location.href = options.callbackUrl
        }
      },
    },
  })
}
