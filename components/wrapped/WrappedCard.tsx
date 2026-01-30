"use client"

import React from "react"

interface WrappedCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: string
  color?: string
  isActive: boolean
}

/**
 * WrappedCard
 * Individual animated card for Fitness Wrapped stats
 * Uses CoachFit's color palette (blues, purples, greens, oranges)
 */
export function WrappedCard({
  title,
  value,
  subtitle,
  icon,
  color = "from-blue-500 to-indigo-600",
  isActive
}: WrappedCardProps) {
  return (
    <div
      className={`
        wrapped-card
        ${isActive ? 'wrapped-card-active' : ''}
        bg-gradient-to-br ${color}
        rounded-3xl p-8 md:p-12 text-white
        shadow-2xl min-h-[450px] md:min-h-[500px]
        flex flex-col items-center justify-center
        text-center
      `}
    >
      {icon && (
        <div className="text-6xl md:text-8xl mb-6 md:mb-8 animate-bounce-slow">
          {icon}
        </div>
      )}
      <h2 className="text-4xl md:text-5xl font-bold mb-3 md:mb-4 animate-fade-in-up">
        {value}
      </h2>
      <h3 className="text-2xl md:text-3xl font-semibold mb-2 animate-fade-in-up animation-delay-200">
        {title}
      </h3>
      {subtitle && (
        <p className="text-lg md:text-xl opacity-90 animate-fade-in-up animation-delay-400 px-4">
          {subtitle}
        </p>
      )}
    </div>
  )
}
