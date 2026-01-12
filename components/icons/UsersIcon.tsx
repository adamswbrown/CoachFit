import React from 'react'

interface UsersIconProps {
  size?: number
  className?: string
}

export const UsersIcon: React.FC<UsersIconProps> = ({ 
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
      {/* User 1 - dark blue */}
      <g transform="translate(15, 20)">
        <circle cx="0" cy="0" r="8" fill="#1e3a5f" />
        <rect x="-6" y="8" width="12" height="15" rx="4" fill="#1e3a5f" />
      </g>
      {/* User 2 - orange */}
      <g transform="translate(45, 20)">
        <circle cx="0" cy="0" r="8" fill="#ff6b35" />
        <rect x="-6" y="8" width="12" height="15" rx="4" fill="#ff6b35" />
      </g>
    </svg>
  )
}
