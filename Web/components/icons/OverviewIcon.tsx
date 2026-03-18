import React from 'react'

interface OverviewIconProps {
  size?: number
  className?: string
}

export const OverviewIcon: React.FC<OverviewIconProps> = ({ 
  size = 24,
  className = '' 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      className={className}
      fill="none"
    >
      {/* Chart bars - dark blue and orange */}
      <rect x="10" y="35" width="8" height="15" rx="2" fill="#1e3a5f" />
      <rect x="22" y="25" width="8" height="25" rx="2" fill="#ff6b35" />
      <rect x="34" y="30" width="8" height="20" rx="2" fill="#1e3a5f" />
      <rect x="46" y="20" width="8" height="30" rx="2" fill="#ff6b35" />
      
      {/* Chart line */}
      <path
        d="M 14 40 L 26 30 L 38 35 L 50 25"
        stroke="#1e3a5f"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
