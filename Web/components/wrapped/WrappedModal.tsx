"use client"

import { useEffect, useState, useRef } from "react"
import html2canvas from "html2canvas"
import { WrappedCarousel } from "./WrappedCarousel"
import type { WrappedSummary } from "@/lib/types"

interface WrappedModalProps {
  isOpen: boolean
  onClose: () => void
  data: WrappedSummary
}

/**
 * WrappedModal
 * Full-screen modal for Fitness Wrapped experience
 * Features:
 * - Copy text summary to clipboard
 * - Export current card as image (using html2canvas)
 * - Full-screen immersive experience
 */
export function WrappedModal({ isOpen, onClose, data }: WrappedModalProps) {
  const [showCopySuccess, setShowCopySuccess] = useState(false)
  const [showExportSuccess, setShowExportSuccess] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [isOpen])

  const handleCopyText = async () => {
    const shareText = `
My Fitness Wrapped 🎉

📊 ${data.totals.entries} days tracked
🔥 ${data.totals.totalCalories.toLocaleString()} calories
👟 ${data.totals.totalSteps.toLocaleString()} steps
💪 ${data.totals.workouts} workouts
${data.totals.weightChange !== null ? `⚖️ ${data.totals.weightChange > 0 ? '+' : ''}${data.totals.weightChange.toFixed(1)} lbs` : ''}

${data.funFacts.map(f => `${f.icon} ${f.comparison}`).join('\n')}

#FitnessWrapped #CoachFit
    `.trim()

    try {
      await navigator.clipboard.writeText(shareText)
      setShowCopySuccess(true)
      setTimeout(() => setShowCopySuccess(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
      alert("Failed to copy to clipboard. Please try again.")
    }
  }

  const handleExportImage = async () => {
    if (!contentRef.current) return

    setIsExporting(true)

    try {
      // Find the active wrapped card
      const carouselElement = contentRef.current.querySelector('.wrapped-card-active')?.parentElement

      if (!carouselElement) {
        throw new Error("Could not find active card")
      }

      // Generate canvas from the card
      const canvas = await html2canvas(carouselElement, {
        backgroundColor: null,
        scale: 2, // Higher quality
        logging: false,
        useCORS: true
      })

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.download = `fitness-wrapped-${Date.now()}.png`
          link.href = url
          link.click()
          URL.revokeObjectURL(url)

          setShowExportSuccess(true)
          setTimeout(() => setShowExportSuccess(false), 2000)
        }
      })
    } catch (error) {
      console.error("Failed to export image:", error)
      alert("Failed to export image. Please try again.")
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 overflow-y-auto">
      {/* Header Controls */}
      <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
        {/* Share Buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleCopyText}
            className="px-4 py-2 md:px-6 md:py-3 bg-white/20 hover:bg-white/30 rounded-full text-white font-semibold transition text-sm md:text-base"
            aria-label="Copy summary"
          >
            📋 Copy Text
          </button>
          <button
            onClick={handleExportImage}
            disabled={isExporting}
            className="px-4 py-2 md:px-6 md:py-3 bg-white/20 hover:bg-white/30 rounded-full text-white font-semibold transition disabled:opacity-50 text-sm md:text-base"
            aria-label="Export image"
          >
            {isExporting ? "⏳ Exporting..." : "📸 Save Image"}
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="text-white text-3xl md:text-4xl hover:scale-110 transition w-10 h-10 flex items-center justify-center"
          aria-label="Close modal"
        >
          ×
        </button>
      </div>

      {/* Success Notifications */}
      {showCopySuccess && (
        <div className="absolute top-20 left-4 md:left-6 z-30 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg animate-fade-in-up">
          ✓ Copied to clipboard!
        </div>
      )}

      {showExportSuccess && (
        <div className="absolute top-20 left-4 md:left-6 z-30 bg-emerald-500 text-white px-4 py-3 rounded-lg shadow-lg animate-fade-in-up">
          ✓ Image saved to downloads!
        </div>
      )}

      {/* Content */}
      <div ref={contentRef} className="container mx-auto px-4 py-20 md:py-24">
        <h1 className="text-4xl md:text-6xl font-bold text-white text-center mb-3 md:mb-4 animate-fade-in-up">
          Your Fitness Wrapped 🎉
        </h1>
        <p className="text-xl md:text-2xl text-white/80 text-center mb-8 md:mb-12 animate-fade-in-up animation-delay-200">
          {data.cohortName || "Your Challenge"}
        </p>

        <WrappedCarousel data={data} />
      </div>
    </div>
  )
}
