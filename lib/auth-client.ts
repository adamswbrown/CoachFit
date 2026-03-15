"use client"

import { useUser, useClerk, useAuth } from "@clerk/nextjs"
import { useMemo } from "react"
import type { Role } from "./types"

/**
 * Clerk-based client auth hooks for CoachFit.
 *
 * Provides compatibility wrappers that return the same shape as the old
 * NextAuth/Better Auth hooks, so 30+ client components don't need changes.
 */

/**
 * useSession() — returns { data: session, status }
 *
 * Maps Clerk's useUser() to the same shape components expect:
 * - status: "loading" | "authenticated" | "unauthenticated"
 * - data: { user: { id, email, name, roles, isTestUser, ... } } | null
 *
 * Note: Roles and custom fields are fetched from publicMetadata (synced from DB via webhook).
 * The DB remains the source of truth; publicMetadata is a read cache for the client.
 */
export function useSession() {
  const { user, isLoaded, isSignedIn } = useUser()

  const status = !isLoaded
    ? ("loading" as const)
    : isSignedIn
      ? ("authenticated" as const)
      : ("unauthenticated" as const)

  // Memoize to prevent infinite re-render loops in useEffect([session]) consumers
  const session = useMemo(() => {
    if (!(isLoaded && isSignedIn && user)) return null

    return {
      user: {
        id: (user.publicMetadata?.dbId as string) ?? user.id,
        email: user.emailAddresses[0]?.emailAddress ?? "",
        name: user.fullName ?? null,
        image: user.imageUrl ?? null,
        roles: ((user.publicMetadata?.roles as Role[]) ?? ["CLIENT"]) as Role[],
        isTestUser: (user.publicMetadata?.isTestUser as boolean) ?? false,
        mustChangePassword: (user.publicMetadata?.mustChangePassword as boolean) ?? false,
        onboardingComplete: (user.publicMetadata?.onboardingComplete as boolean) ?? false,
      },
    }
  }, [isLoaded, isSignedIn, user?.id, user?.fullName, user?.imageUrl, user?.publicMetadata, user?.emailAddresses])

  return { data: session, status }
}

/**
 * signIn() — compatible with old signIn("credentials", { ... }) / signIn("google") pattern.
 *
 * With Clerk, sign-in is handled by the <SignIn /> component or Clerk's hosted pages.
 * This function redirects to the sign-in page for the requested flow.
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
  // Clerk handles sign-in via its components/hosted UI.
  // Redirect to the sign-in page.
  const callbackUrl = options?.callbackUrl || "/dashboard"
  window.location.href = `/login?redirect_url=${encodeURIComponent(callbackUrl)}`
  return { error: null, ok: true }
}

/**
 * signOut() — compatible with old signOut({ callbackUrl }) pattern.
 */
export async function signOut(options?: { callbackUrl?: string }) {
  // This is a no-op function for compatibility.
  // Components that need sign-out should use the useClerk() hook directly
  // or the <UserButton /> component. For programmatic sign-out:
  window.location.href = `/login`
}

/**
 * Hook for programmatic sign-out (use in components that need it).
 */
export function useSignOut() {
  const { signOut: clerkSignOut } = useClerk()
  return async (options?: { callbackUrl?: string }) => {
    await clerkSignOut({ redirectUrl: options?.callbackUrl || "/login" })
  }
}
