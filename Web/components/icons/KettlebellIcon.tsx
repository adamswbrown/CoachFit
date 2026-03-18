import React from 'react'

interface KettlebellIconProps {
  size?: number
  className?: string
}

export const KettlebellIcon: React.FC<KettlebellIconProps> = ({ 
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
      {/* Kettlebell body - glossy orange */}
      <ellipse cx="40" cy="45" rx="20" ry="25" fill="#ff6b35" />
      <ellipse cx="40" cy="40" rx="18" ry="22" fill="#ff8c5a" />
      
      {/* Handle */}
      <rect x="38" y="15" width="4" height="12" rx="2" fill="#ffffff" />
      
      {/* White flame rising from handle */}
      <path
        d="M38 12 Q38 5 40 0 Q42 5 42 12"
        fill="#ffffff"
        opacity="0.9"
      />
      <path
        d="M39 10 Q39 6 40 3 Q41 6 41 10"
        fill="#ffffff"
      />
      
      {/* Highlight for glossy effect */}
      <ellipse cx="35" cy="38" rx="6" ry="8" fill="#ffffff" opacity="0.3" />
    </svg>
  )
}
