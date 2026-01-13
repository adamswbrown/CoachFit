import React from 'react'

interface MobileIconProps {
  size?: number
  className?: string
}

export const MobileIcon: React.FC<MobileIconProps> = ({
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
      {/* Smartphone outline */}
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      {/* Home button indicator */}
      <line x1="12" y1="18" x2="12" y2="18" />
      {/* HealthKit heart icon in center */}
      <path d="M12 8.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5 1.5-2.5 3 0 2.5 5 5 5 5s5-2.5 5-5c0-1.5-1-3-2.5-3-1 0-2 .5-2.5 1.5z" fill="currentColor" stroke="none" />
    </svg>
  )
}
