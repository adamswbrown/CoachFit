"use client"

import { useState, useMemo } from "react"
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

interface DataPoint {
  date: string
  weightLbs?: number | null
  steps?: number | null
  calories?: number | null
  sleepQuality?: number | null
  perceivedStress?: number | null
}

type Metric = "weightLbs" | "steps" | "calories" | "sleepQuality" | "perceivedStress"

const METRICS: { key: Metric; label: string; color: string; unit: string }[] = [
  { key: "weightLbs", label: "Weight", color: "#2563eb", unit: "lbs" },
  { key: "steps", label: "Steps", color: "#16a34a", unit: "" },
  { key: "calories", label: "Calories", color: "#ea580c", unit: "kcal" },
  { key: "sleepQuality", label: "Sleep", color: "#7c3aed", unit: "/10" },
  { key: "perceivedStress", label: "Stress", color: "#dc2626", unit: "/10" },
]

interface ProgressTimelineProps {
  entries: DataPoint[]
}

export function ProgressTimeline({ entries }: ProgressTimelineProps) {
  const [selectedMetric, setSelectedMetric] = useState<Metric>("weightLbs")

  const metric = METRICS.find((m) => m.key === selectedMetric)!

  const chartData = useMemo(() => {
    return entries
      .filter((e) => e[selectedMetric] != null)
      .map((e) => ({
        date: new Date(e.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
        value: e[selectedMetric] as number,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [entries, selectedMetric])

  if (entries.length === 0) {
    return (
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <h3 className="text-base font-medium text-neutral-900 mb-2">Progress Timeline</h3>
        <p className="text-sm text-neutral-500">No progress data yet.</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-6">
      <h3 className="text-base font-medium text-neutral-900 mb-4">Progress Timeline</h3>

      {/* Metric tabs */}
      <div className="flex gap-1 mb-4 bg-neutral-100 rounded-lg p-1 overflow-x-auto">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setSelectedMetric(m.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              selectedMetric === m.key
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-neutral-400 py-8 text-center">No {metric.label.toLowerCase()} data recorded.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#999" />
            <YAxis tick={{ fontSize: 11 }} stroke="#999" width={50} />
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e5e5" }}
              formatter={(value: number) => [`${value}${metric.unit ? ` ${metric.unit}` : ""}`, metric.label]}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={metric.color}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
