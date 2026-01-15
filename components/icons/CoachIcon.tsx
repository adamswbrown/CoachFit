import React from 'react'

interface CoachIconProps {
  size?: number
  className?: string
}

export const CoachIcon: React.FC<CoachIconProps> = ({ 
  size = 64,
  className = '' 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 60 80"
      className={className}
    >
      {/* Coach figure standing upright - dark blue */}
      <g fill="#1e3a5f">
        {/* Head */}
        <circle cx="30" cy="12" r="8" />
        
        {/* Body */}
        <rect x="24" y="20" width="12" height="25" rx="4" />
        
        {/* Arms holding laptop */}
        <rect x="18" y="28" width="6" height="12" rx="2" />
        <rect x="36" y="28" width="6" height="12" rx="2" />
        
        {/* Laptop */}
        <rect x="20" y="32" width="20" height="12" rx="1" fill="#ffffff" />
        <rect x="22" y="34" width="16" height="8" rx="0.5" fill="#1e3a5f" opacity="0.3" />
        
        {/* Legs */}
        <rect x="26" y="45" width="4" height="20" rx="2" />
        <rect x="30" y="45" width="4" height="20" rx="2" />
      </g>
    </svg>
  )
}
