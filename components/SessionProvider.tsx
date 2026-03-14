"use client"

import { ErrorBoundary } from "./ErrorBoundary"

/**
 * Session provider wrapper.
 *
 * Better Auth uses cookie-based sessions with its own client hooks,
 * so no provider wrapper is needed (unlike NextAuth's SessionProvider).
 * We keep this component for the ErrorBoundary and to minimize layout changes.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  )
}
