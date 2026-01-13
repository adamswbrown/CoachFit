"use client"

import React from "react"

interface DataSourceBadgeProps {
  dataSources: string[] | null | undefined
  size?: "sm" | "md"
  showLabel?: boolean
}

/**
 * Badge component to indicate data source origin (HealthKit, Manual, etc.)
 * Used in coach dashboards to distinguish automated vs manual entries.
 */
export function DataSourceBadge({
  dataSources,
  size = "sm",
  showLabel = true
}: DataSourceBadgeProps) {
  // Normalize data sources
  const sources = Array.isArray(dataSources) ? dataSources : []

  const hasHealthKit = sources.some(s =>
    s.toLowerCase() === "healthkit" || s.toLowerCase() === "apple_health"
  )
  const hasManual = sources.some(s => s.toLowerCase() === "manual")
  const hasStrava = sources.some(s => s.toLowerCase() === "strava")

  // Default to manual if no sources specified
  const isManualOnly = sources.length === 0 || (hasManual && !hasHealthKit && !hasStrava)

  const sizeClasses = {
    sm: "text-xs px-1.5 py-0.5",
    md: "text-sm px-2 py-1"
  }

  const iconSize = size === "sm" ? 12 : 14

  // Multiple sources
  if (hasHealthKit && hasManual) {
    return (
      <div className="flex items-center gap-1">
        <span className={`inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-700 font-medium ${sizeClasses[size]}`}>
          <AppleIcon size={iconSize} />
          {showLabel && "HealthKit"}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full bg-neutral-100 text-neutral-600 font-medium ${sizeClasses[size]}`}>
          <PencilIcon size={iconSize} />
          {showLabel && "Manual"}
        </span>
      </div>
    )
  }

  // HealthKit only
  if (hasHealthKit) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-700 font-medium ${sizeClasses[size]}`}>
        <AppleIcon size={iconSize} />
        {showLabel && "HealthKit"}
      </span>
    )
  }

  // Strava
  if (hasStrava) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 font-medium ${sizeClasses[size]}`}>
        <StravaIcon size={iconSize} />
        {showLabel && "Strava"}
      </span>
    )
  }

  // Manual (default)
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-neutral-100 text-neutral-600 font-medium ${sizeClasses[size]}`}>
      <PencilIcon size={iconSize} />
      {showLabel && "Manual"}
    </span>
  )
}

// Mini icons for the badges
function AppleIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}

function PencilIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
      <path d="m15 5 4 4"/>
    </svg>
  )
}

function StravaIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169"/>
    </svg>
  )
}

export default DataSourceBadge
