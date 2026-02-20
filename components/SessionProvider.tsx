"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import { ErrorBoundary } from "./ErrorBoundary"

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <NextAuthSessionProvider refetchOnWindowFocus={false}>
        {children}
      </NextAuthSessionProvider>
    </ErrorBoundary>
  )
}
