import React from 'react'

interface RunnerIconProps {
  size?: number
  className?: string
}

export const RunnerIcon: React.FC<RunnerIconProps> = ({ 
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
      {/* Runner figure in dynamic running pose - orange */}
      <g fill="#ff6b35">
        {/* Head */}
        <circle cx="30" cy="12" r="8" />
        
        {/* Body */}
        <rect x="26" y="20" width="8" height="20" rx="4" />
        
        {/* Arms in running motion */}
        <ellipse cx="20" cy="25" rx="4" ry="12" transform="rotate(-30 20 25)" />
        <ellipse cx="40" cy="28" rx="4" ry="12" transform="rotate(45 40 28)" />
        
        {/* Legs in running motion */}
        <ellipse cx="25" cy="50" rx="5" ry="18" transform="rotate(-20 25 50)" />
        <ellipse cx="35" cy="52" rx="5" ry="18" transform="rotate(25 35 52)" />
      </g>
    </svg>
  )
}
