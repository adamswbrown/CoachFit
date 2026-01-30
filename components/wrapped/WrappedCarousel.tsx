"use client"

import { useState, useEffect } from "react"
import { WrappedCard } from "./WrappedCard"
import type { WrappedSummary } from "@/lib/types"

interface WrappedCarouselProps {
  data: WrappedSummary
}

/**
 * WrappedCarousel
 * Displays wrapped stats in an interactive card carousel
 * With keyboard navigation, arrows, and progress dots
 */
export function WrappedCarousel({ data }: WrappedCarouselProps) {
  const [currentCard, setCurrentCard] = useState(0)

  // Build cards dynamically based on available data
  const cards = [
    {
      title: "Total Entries",
      value: data.totals.entries,
      subtitle: data.totals.entries === 0
        ? "Keep building momentum! 💪"
        : `${data.totals.entries} days of tracking!`,
      icon: "📊",
      color: "from-emerald-500 to-teal-600"
    },
    {
      title: "Total Calories",
      value: data.totals.totalCalories.toLocaleString(),
      subtitle: data.funFacts.find(f => f.metric === "calories")?.comparison || "",
      icon: "🔥",
      color: "from-orange-500 to-red-600"
    },
    {
      title: "Total Steps",
      value: data.totals.totalSteps.toLocaleString(),
      subtitle: data.funFacts.find(f => f.metric === "steps")?.comparison || "",
      icon: "👟",
      color: "from-blue-500 to-indigo-600"
    },
    {
      title: "Workouts Completed",
      value: data.totals.workouts,
      subtitle: data.totals.workouts > 0
        ? `${Math.round(data.totals.totalWorkoutMins)} minutes total!`
        : "Start your fitness journey! 💪",
      icon: "💪",
      color: "from-purple-500 to-pink-600"
    },
    {
      title: "Sleep Time",
      value: data.totals.totalSleepMins > 0
        ? `${Math.round(data.totals.totalSleepMins / 60)}h`
        : "0h",
      subtitle: data.funFacts.find(f => f.metric === "sleep")?.comparison || "Rest is important!",
      icon: "😴",
      color: "from-indigo-500 to-purple-600"
    }
  ]

  // Add weight change card if available
  if (data.totals.weightChange !== null) {
    cards.push({
      title: "Weight Change",
      value: `${data.totals.weightChange > 0 ? '+' : ''}${data.totals.weightChange.toFixed(1)} lbs`,
      subtitle: data.funFacts.find(f => f.metric === "weight")?.comparison ||
                (data.totals.weightChange < 0 ? "Amazing progress!" : "Keep going!"),
      icon: data.totals.weightChange < 0 ? "🎉" : "💪",
      color: "from-amber-500 to-orange-600"
    })
  }

  // Add best day card if there's data
  if (data.topMetrics.bestStepsDay > 0) {
    cards.push({
      title: "Best Day",
      value: data.topMetrics.bestStepsDay.toLocaleString(),
      subtitle: "steps in one day! 🏆",
      icon: "🏆",
      color: "from-yellow-500 to-amber-600"
    })
  }

  // Add consistency streak card
  if (data.streaks.longestEntryStreak > 0) {
    cards.push({
      title: "Consistency Streak",
      value: `${data.streaks.longestEntryStreak} ${data.streaks.longestEntryStreak === 1 ? 'day' : 'days'}`,
      subtitle: "Your longest streak! 🔥",
      icon: "🔥",
      color: "from-red-500 to-pink-600"
    })
  }

  const nextCard = () => {
    setCurrentCard((prev) => (prev + 1) % cards.length)
  }

  const prevCard = () => {
    setCurrentCard((prev) => (prev - 1 + cards.length) % cards.length)
  }

  const goToCard = (index: number) => {
    setCurrentCard(index)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") nextCard()
      if (e.key === "ArrowLeft") prevCard()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Card Container */}
      <div className="relative aspect-[3/4] overflow-hidden">
        {cards.map((card, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-all duration-500 ${
              index === currentCard ? 'z-10' : 'z-0 opacity-0'
            }`}
          >
            <WrappedCard {...card} isActive={index === currentCard} />
          </div>
        ))}
      </div>

      {/* Navigation Controls */}
      <div className="flex justify-between items-center mt-8 px-4">
        <button
          onClick={prevCard}
          className="px-4 py-2 md:px-6 md:py-3 bg-white/20 hover:bg-white/30 rounded-full text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
          disabled={currentCard === 0}
          aria-label="Previous card"
        >
          ← Previous
        </button>

        {/* Progress Dots */}
        <div className="flex gap-2">
          {cards.map((_, index) => (
            <button
              key={index}
              onClick={() => goToCard(index)}
              className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition ${
                index === currentCard ? 'bg-white scale-125' : 'bg-white/40'
              }`}
              aria-label={`Go to card ${index + 1}`}
            />
          ))}
        </div>

        <button
          onClick={nextCard}
          className="px-4 py-2 md:px-6 md:py-3 bg-white/20 hover:bg-white/30 rounded-full text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
          disabled={currentCard === cards.length - 1}
          aria-label="Next card"
        >
          Next →
        </button>
      </div>

      {/* Card Counter */}
      <div className="text-center mt-4 text-white/80 text-sm">
        {currentCard + 1} / {cards.length}
      </div>
    </div>
  )
}
