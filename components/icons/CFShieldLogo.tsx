import React from 'react'

interface CFShieldLogoProps {
  size?: number
  className?: string
}

export const CFShieldLogo: React.FC<CFShieldLogoProps> = ({ 
  size = 64,
  className = '' 
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 120"
      className={className}
      style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2))' }}
    >
      {/* Shield shape - dark blue */}
      <path
        d="M50 10 L20 25 L20 70 Q20 90 30 100 Q40 110 50 115 Q60 110 70 100 Q80 90 80 70 L80 25 Z"
        fill="#1e3a5f"
      />
      
      {/* Orange accent on top-right corner */}
      <path
        d="M50 10 L80 25 L80 35 L50 20 Z"
        fill="#ff6b35"
      />
      
      {/* CF letters - white */}
      <text
        x="50"
        y="70"
        fontSize="32"
        fontWeight="bold"
        fill="#ffffff"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
      >
        CF
      </text>
      
      {/* Orange outline/shadow on C */}
      <text
        x="50"
        y="70"
        fontSize="32"
        fontWeight="bold"
        fill="#ff6b35"
        textAnchor="middle"
        fontFamily="Arial, sans-serif"
        opacity="0.5"
        transform="translate(2, 2)"
      >
        C
      </text>
    </svg>
  )
}
