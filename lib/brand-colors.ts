// Coach Fit Brand Colors
// Based on the brand guidelines: dark blue, orange, white, and yellow-orange gradient

export const brandColors = {
  // Primary Colors
  darkBlue: '#1e3a5f', // Dark blue for shields and primary elements
  orange: '#ff6b35', // Orange for accents, flames, and highlights
  white: '#ffffff',
  
  // Gradient Colors
  yellowOrange: {
    start: '#ffd93d', // Brighter yellow-orange (top-left)
    end: '#ff6b35', // Deeper orange (bottom-right)
  },
  
  // Semantic Colors (using brand palette)
  primary: '#1e3a5f',
  secondary: '#ff6b35',
  accent: '#ffd93d',
  
  // Background
  backgroundGradient: 'linear-gradient(135deg, #ffd93d 0%, #ff6b35 100%)',
} as const
