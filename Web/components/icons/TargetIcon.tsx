import React from 'react'

interface TargetIconProps {
  size?: number
  className?: string
}

export const TargetIcon: React.FC<TargetIconProps> = ({ 
  size = 64,
  className = '' 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      className={className}
    >
      {/* Target circles */}
      <circle cx="40" cy="40" r="30" fill="#1e3a5f" />
      <circle cx="40" cy="40" r="22" fill="#ffffff" />
      <circle cx="40" cy="40" r="15" fill="#ff6b35" />
      <circle cx="40" cy="40" r="8" fill="#ffffff" />
      <circle cx="40" cy="40" r="5" fill="#1e3a5f" />
      
      {/* Arrow striking bullseye from top-right */}
      <g transform="translate(40, 40)">
        {/* Arrow shaft */}
        <line
          x1="20"
          y1="-20"
          x2="5"
          y2="-5"
          stroke="#ff6b35"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Arrow head */}
        <path
          d="M 5 -5 L 0 0 L 3 3 L -3 3 L 0 0 Z"
          fill="#ff6b35"
        />
        {/* White tip */}
        <path
          d="M 3 -3 L 0 0 L 2 2 L -2 2 L 0 0 Z"
          fill="#ffffff"
        />
      </g>
      
      {/* Starburst effect at impact */}
      <g transform="translate(40, 40)">
        <circle cx="0" cy="0" r="3" fill="#ffd93d" opacity="0.8" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
          <line
            key={angle}
            x1="0"
            y1="0"
            x2="6"
            y2="0"
            stroke="#ffd93d"
            strokeWidth="1.5"
            transform={`rotate(${angle})`}
            strokeLinecap="round"
          />
        ))}
      </g>
    </svg>
  )
}
