import React from 'react'

interface ClientsIconProps {
  size?: number
  className?: string
}

export const ClientsIcon: React.FC<ClientsIconProps> = ({ 
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
      {/* Multiple user figures - using RunnerIcon and CoachIcon style */}
      {/* Runner (orange) */}
      <g transform="translate(15, 30)">
        <circle cx="0" cy="0" r="6" fill="#ff6b35" />
        <rect x="-4" y="6" width="8" height="12" rx="2" fill="#ff6b35" />
        <ellipse cx="-3" cy="10" rx="2" ry="6" transform="rotate(-20 -3 10)" fill="#ff6b35" />
        <ellipse cx="3" cy="12" rx="2" ry="6" transform="rotate(20 3 12)" fill="#ff6b35" />
      </g>
      
      {/* Coach (dark blue) */}
      <g transform="translate(30, 30)">
        <circle cx="0" cy="0" r="6" fill="#1e3a5f" />
        <rect x="-4" y="6" width="8" height="12" rx="2" fill="#1e3a5f" />
        <rect x="-6" y="8" width="4" height="8" rx="1" fill="#1e3a5f" />
        <rect x="2" y="8" width="4" height="8" rx="1" fill="#1e3a5f" />
        <rect x="-5" y="10" width="10" height="6" rx="0.5" fill="#ffffff" />
      </g>
      
      {/* Another user (orange) */}
      <g transform="translate(45, 30)">
        <circle cx="0" cy="0" r="6" fill="#ff6b35" />
        <rect x="-4" y="6" width="8" height="12" rx="2" fill="#ff6b35" />
      </g>
    </svg>
  )
}
