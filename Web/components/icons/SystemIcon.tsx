import React from 'react'

interface SystemIconProps {
  size?: number
  className?: string
}

export const SystemIcon: React.FC<SystemIconProps> = ({ 
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
      {/* Gear - dark blue */}
      <circle cx="30" cy="30" r="18" fill="#1e3a5f" />
      <circle cx="30" cy="30" r="12" fill="#ffffff" />
      <circle cx="30" cy="30" r="6" fill="#1e3a5f" />
      
      {/* Gear teeth - orange accents */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <rect
          key={i}
          x="28"
          y="8"
          width="4"
          height="6"
          rx="1"
          fill="#ff6b35"
          transform={`rotate(${angle} 30 30)`}
        />
      ))}
    </svg>
  )
}
