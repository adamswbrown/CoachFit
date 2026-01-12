"use client"

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession, signOut } from 'next-auth/react'
import { CoachFitLogo } from '../CoachFitLogo'
import { brandColors } from '@/lib/brand-colors'

interface CoachLayoutProps {
  children: React.ReactNode
}

export const CoachLayout: React.FC<CoachLayoutProps> = ({ children }) => {
  const pathname = usePathname()
  const { data: session } = useSession()

  const navigation = [
    { name: 'Clients', href: '/coach-dashboard' },
    { name: 'Cohorts', href: '/coach-dashboard?filter=all' },
  ]

  const isActive = (href: string) => {
    if (href === '/coach-dashboard') {
      return pathname === '/coach-dashboard'
    }
    return pathname?.startsWith(href)
  }

  return (
    <div className="min-h-screen" style={{ background: '#f9fafb' }}>
      {/* Top Navigation Bar */}
      <nav 
        className="border-b"
        style={{ 
          backgroundColor: brandColors.white,
          borderColor: '#e5e7eb'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/coach-dashboard" className="flex items-center">
              <CoachFitLogo size="sm" showText={true} />
            </Link>

            {/* Navigation Links */}
            <div className="flex items-center gap-6">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'text-white'
                      : 'text-neutral-700 hover:text-neutral-900'
                  }`}
                  style={
                    isActive(item.href)
                      ? { backgroundColor: brandColors.orange }
                      : {}
                  }
                >
                  {item.name}
                </Link>
              ))}
            </div>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              {session?.user && (
                <span className="text-sm text-neutral-700">
                  {session.user.name || session.user.email}
                </span>
              )}
              <button
                onClick={() => signOut()}
                className="px-4 py-2 rounded-md text-sm font-medium transition-colors"
                style={{
                  color: brandColors.darkBlue,
                  border: `1px solid ${brandColors.darkBlue}`,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = brandColors.darkBlue
                  e.currentTarget.style.color = brandColors.white
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = brandColors.darkBlue
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
