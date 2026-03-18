import React from 'react'

interface DumbbellsIconProps {
  size?: number
  className?: string
}

export const DumbbellsIcon: React.FC<DumbbellsIconProps> = ({ 
  size = 64,
  className = '' 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 40"
      className={className}
    >
      {/* Left dumbbell - dark blue plates, orange handle */}
      <g transform="translate(10, 20)">
        {/* Weight plates - dark blue */}
        <circle cx="-8" cy="0" r="8" fill="#1e3a5f" />
        <circle cx="8" cy="0" r="8" fill="#1e3a5f" />
        {/* White accents */}
        <circle cx="-8" cy="0" r="5" fill="#ffffff" opacity="0.5" />
        <circle cx="8" cy="0" r="5" fill="#ffffff" opacity="0.5" />
        {/* Handle - orange */}
        <rect x="-2" y="-2" width="4" height="4" rx="1" fill="#ff6b35" />
      </g>
      
      {/* Right dumbbell - orange plates, dark blue handle */}
      <g transform="translate(70, 20) rotate(-10)">
        {/* Weight plates - orange */}
        <circle cx="-8" cy="0" r="8" fill="#ff6b35" />
        <circle cx="8" cy="0" r="8" fill="#ff6b35" />
        {/* White accents */}
        <circle cx="-8" cy="0" r="5" fill="#ffffff" opacity="0.5" />
        <circle cx="8" cy="0" r="5" fill="#ffffff" opacity="0.5" />
        {/* Handle - dark blue */}
        <rect x="-2" y="-2" width="4" height="4" rx="1" fill="#1e3a5f" />
      </g>
    </svg>
  )
}
