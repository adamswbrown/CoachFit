/**
 * PWA Icon Generator Script
 *
 * Generates all required PWA icons from the base SVG logo.
 * Run with: npx tsx scripts/generate-pwa-icons.ts
 *
 * Requires: npm install sharp (if not already installed)
 */

import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const MASKABLE_SIZES = [192, 512]

// CoachFit brand color
const BRAND_COLOR = '#1E3A8A'
const BACKGROUND_COLOR = '#FFFFFF'

// SVG template for the icon (simplified version without text for small sizes)
const createIconSvg = (size: number, isMaskable: boolean = false): string => {
  // For maskable icons, we need a safe zone (padding) - icon content should be in center 80%
  const padding = isMaskable ? size * 0.1 : 0
  const contentSize = size - (padding * 2)
  const scale = contentSize / 512

  // Calculate scaled positions
  const cx = padding + (256 * scale)
  const cy = padding + (256 * scale)
  const r = 220 * scale
  const strokeWidth = 28 * scale

  // Arrow path scaled
  const arrowPath = `M${padding + 180 * scale} ${padding + 300 * scale} L${padding + 256 * scale} ${padding + 140 * scale} L${padding + 332 * scale} ${padding + 300 * scale}`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${isMaskable ? `<rect width="${size}" height="${size}" fill="${BACKGROUND_COLOR}"/>` : ''}
  <circle cx="${cx}" cy="${cy}" r="${r}" stroke="${BRAND_COLOR}" stroke-width="${strokeWidth}" fill="${isMaskable ? 'none' : BACKGROUND_COLOR}"/>
  <path d="${arrowPath}" stroke="${BRAND_COLOR}" stroke-width="${strokeWidth}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
}

async function generateIcons(): Promise<void> {
  const outputDir = path.join(process.cwd(), 'public', 'icons')

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  console.log('Generating PWA icons...\n')

  // Generate standard icons
  for (const size of ICON_SIZES) {
    const svg = createIconSvg(size, false)
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`)

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath)

    console.log(`  Created: icon-${size}x${size}.png`)
  }

  // Generate maskable icons (for Android adaptive icons)
  for (const size of MASKABLE_SIZES) {
    const svg = createIconSvg(size, true)
    const outputPath = path.join(outputDir, `maskable-icon-${size}x${size}.png`)

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath)

    console.log(`  Created: maskable-icon-${size}x${size}.png`)
  }

  // Generate Apple touch icon (180x180)
  const appleSvg = createIconSvg(180, false)
  await sharp(Buffer.from(appleSvg))
    .png()
    .toFile(path.join(outputDir, 'apple-touch-icon.png'))
  console.log(`  Created: apple-touch-icon.png (180x180)`)

  // Generate favicon
  const faviconSvg = createIconSvg(32, false)
  await sharp(Buffer.from(faviconSvg))
    .png()
    .toFile(path.join(process.cwd(), 'public', 'favicon.png'))
  console.log(`  Created: favicon.png (32x32)`)

  // Create favicon.ico (16x16 and 32x32)
  const favicon16Svg = createIconSvg(16, false)
  const favicon32Svg = createIconSvg(32, false)

  // Create both sizes as PNG first
  await sharp(Buffer.from(favicon16Svg))
    .png()
    .toFile(path.join(outputDir, 'favicon-16x16.png'))
  await sharp(Buffer.from(favicon32Svg))
    .png()
    .toFile(path.join(outputDir, 'favicon-32x32.png'))

  console.log(`  Created: favicon-16x16.png and favicon-32x32.png`)

  console.log('\nPWA icons generated successfully!')
  console.log('\nNote: For favicon.ico, you can use an online converter or the png-to-ico package')
}

// Run the script
generateIcons().catch(console.error)
