import React from 'react'
import { ShieldLogo } from './icons'

interface CoachFitLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showText?: boolean
  className?: string
}

export const CoachFitLogo: React.FC<CoachFitLogoProps> = ({ 
  size = 'md',
  showText = true,
  className = '' 
}) => {
  const shieldSize = size === 'sm' ? 48 : size === 'md' ? 64 : size === 'lg' ? 80 : size === 'xl' ? 120 : 64
  const textSize = size === 'sm' ? 'text-xl' : size === 'md' ? 'text-2xl' : size === 'lg' ? 'text-3xl' : size === 'xl' ? 'text-4xl' : 'text-2xl'

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <ShieldLogo size={shieldSize} variant="default" />
      {showText && (
        <div className={`${textSize} font-bold`} style={{ 
          filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
        }}>
          <span style={{ color: '#1e3a5f' }}>Coach</span>
          <span style={{ color: '#ff6b35' }}> Fit</span>
        </div>
      )}
    </div>
  )
}
