import React from 'react'

interface ShieldLogoProps {
  variant?: 'default' | 'orange' | 'blue'
  size?: number
  className?: string
}

export const ShieldLogo: React.FC<ShieldLogoProps> = ({ 
  variant = 'default', 
  size = 64,
  className = '' 
}) => {
  const shieldColor = variant === 'orange' ? '#ff6b35' : '#1e3a5f'
  const kettlebellColor = variant === 'orange' ? '#ffffff' : '#ffffff'
  const flameColor = variant === 'orange' ? '#1e3a5f' : '#ff6b35'
  const swooshColor = variant === 'orange' ? '#1e3a5f' : '#ff6b35'
  const accentColor = variant === 'orange' ? '#1e3a5f' : '#ff6b35'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 120"
      className={className}
      style={{ filter: 'drop-shadow(0 4px 6px rgba(0, 0, 0, 0.2))' }}
    >
      {/* Shield shape */}
      <path
        d="M50 10 L20 25 L20 70 Q20 90 30 100 Q40 110 50 115 Q60 110 70 100 Q80 90 80 70 L80 25 Z"
        fill={shieldColor}
      />
      
      {/* Orange accent on lower portion */}
      <path
        d="M20 50 L80 50 L80 70 Q80 90 70 100 Q60 110 50 115 Q40 110 30 100 Q20 90 20 70 Z"
        fill={accentColor}
      />
      
      {/* Kettlebell */}
      <g transform="translate(50, 60)">
        {/* Kettlebell body */}
        <ellipse cx="0" cy="5" rx="12" ry="15" fill={kettlebellColor} />
        <rect x="-2" y="-8" width="4" height="8" rx="2" fill={kettlebellColor} />
        
        {/* Orange flame rising from handle */}
        <path
          d="M-3 -12 Q-3 -18 -1 -22 Q1 -26 0 -28 Q-1 -26 -3 -22 Q-3 -18 -3 -12 Z"
          fill={flameColor}
        />
        
        {/* Orange swoosh wrapping around base */}
        <path
          d="M-12 15 Q-8 20 0 22 Q8 20 12 15"
          stroke={swooshColor}
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
      </g>
      
    </svg>
  )
}
