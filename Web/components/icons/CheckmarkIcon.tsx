import React from 'react'

interface CheckmarkIconProps {
  size?: number
  className?: string
}

export const CheckmarkIcon: React.FC<CheckmarkIconProps> = ({ 
  size = 64,
  className = '' 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 60"
      className={className}
    >
      {/* Simple orange checkmark pointing right */}
      <path
        d="M 10 30 L 25 45 L 50 15"
        stroke="#ff6b35"
        strokeWidth="6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
