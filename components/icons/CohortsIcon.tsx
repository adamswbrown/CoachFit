import React from 'react'

interface CohortsIconProps {
  size?: number
  className?: string
}

export const CohortsIcon: React.FC<CohortsIconProps> = ({ 
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
      {/* Folder - dark blue with orange accent */}
      <path
        d="M 10 15 L 10 45 L 50 45 L 50 25 L 30 25 L 25 20 L 10 20 Z"
        fill="#1e3a5f"
      />
      
      {/* Folder tab - orange */}
      <path
        d="M 10 15 L 25 15 L 30 20 L 10 20 Z"
        fill="#ff6b35"
      />
      
      {/* Folder highlight */}
      <path
        d="M 12 17 L 23 17 L 28 22 L 12 22 Z"
        fill="#ffffff"
        opacity="0.3"
      />
    </svg>
  )
}
