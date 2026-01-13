import React from 'react'

interface HealthKitIconProps {
  size?: number
  className?: string
}

export const HealthKitIcon: React.FC<HealthKitIconProps> = ({
  size = 24,
  className = ''
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Heart monitor/health data icon */}
      <rect x="2" y="4" width="20" height="16" rx="2" />
      {/* Heart rate line */}
      <polyline points="6 12 9 12 10 9 12 15 14 12 18 12" />
    </svg>
  )
}
