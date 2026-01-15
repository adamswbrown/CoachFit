import React from 'react'

interface AttentionIconProps {
  size?: number
  className?: string
}

export const AttentionIcon: React.FC<AttentionIconProps> = ({ 
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
      {/* Bell - dark blue */}
      <path
        d="M 30 10 L 20 10 Q 15 10 12.5 12.5 Q 10 15 10 20 L 10 25 Q 10 30 8 32 L 8 35 L 52 35 L 52 32 Q 50 30 50 25 L 50 20 Q 50 15 47.5 12.5 Q 45 10 40 10 Z"
        fill="#1e3a5f"
      />
      
      {/* Orange accent on bell */}
      <path
        d="M 30 15 L 15 15 Q 13 15 12 16 Q 11 17 11 19 L 11 23 Q 11 25 10 26 L 10 28 L 50 28 L 50 26 Q 49 25 49 23 L 49 19 Q 49 17 48 16 Q 47 15 45 15 Z"
        fill="#ff6b35"
      />
      
      {/* Clapper - orange */}
      <ellipse cx="30" cy="30" rx="3" ry="4" fill="#ff6b35" />
      
      {/* Handle loop - dark blue */}
      <path
        d="M 30 10 L 30 5 Q 30 3 28 3 Q 26 3 26 5 L 26 10"
        stroke="#1e3a5f"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}
