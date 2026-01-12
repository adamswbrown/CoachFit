"use client"

import { LineChart, Line, ResponsiveContainer } from "recharts"

interface TrendSparklineProps {
  data: Array<{ date: string; value: number }>
  color?: string
  height?: number
  showDirection?: boolean
}

export function TrendSparkline({
  data,
  color = "#3b82f6",
  height = 40,
  showDirection = true,
}: TrendSparklineProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <span className="text-xs text-gray-400">No data</span>
      </div>
    )
  }

  // Calculate direction
  const firstValue = data[0]?.value || 0
  const lastValue = data[data.length - 1]?.value || 0
  const change = lastValue - firstValue
  const percentage = firstValue > 0 ? (change / firstValue) * 100 : 0

  // Normalize data for display (maintain relative values)
  const maxValue = Math.max(...data.map((d) => d.value))
  const minValue = Math.min(...data.map((d) => d.value))
  const range = maxValue - minValue || 1

  const normalizedData = data.map((d) => ({
    date: d.date,
    value: range > 0 ? ((d.value - minValue) / range) * 100 : 50,
    originalValue: d.value,
  }))

  return (
    <div className="flex items-center gap-2">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={normalizedData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
      {showDirection && (
        <div className="flex flex-col items-end min-w-[60px]">
          <span
            className={`text-xs font-semibold ${
              change > 0 ? "text-green-600" : change < 0 ? "text-red-600" : "text-gray-600"
            }`}
          >
            {change > 0 ? "↑" : change < 0 ? "↓" : "→"}
          </span>
          <span className="text-xs text-gray-500">
            {Math.abs(percentage).toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  )
}
