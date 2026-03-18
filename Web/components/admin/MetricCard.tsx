"use client"

import { TrendSparkline } from "./TrendSparkline"
import { Trend } from "@/lib/admin/insights"

interface MetricCardProps {
  title: string
  value: string | number
  unit?: string
  trend?: Trend | null
  insight?: string | null
  severity?: "info" | "warning" | "error" | "success"
  action?: {
    label: string
    onClick: () => void
  }
  className?: string
}

export function MetricCard({
  title,
  value,
  unit,
  trend,
  insight,
  severity = "info",
  action,
  className = "",
}: MetricCardProps) {
  const severityColors = {
    info: "border-blue-200 bg-blue-50",
    warning: "border-amber-200 bg-amber-50",
    error: "border-red-200 bg-red-50",
    success: "border-green-200 bg-green-50",
  }

  const severityTextColors = {
    info: "text-blue-800",
    warning: "text-amber-800",
    error: "text-red-800",
    success: "text-green-800",
  }

  return (
    <div
      className={`rounded-lg border p-4 ${severityColors[severity]} ${className}`}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-700">{title}</h3>
        {trend && (
          <span
            className={`text-xs px-2 py-1 rounded ${
              trend.direction === "up"
                ? "bg-green-100 text-green-700"
                : trend.direction === "down"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"}
          </span>
        )}
      </div>

      <div className="mb-3">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          {unit && <span className="text-sm text-gray-600">{unit}</span>}
        </div>
      </div>

      {trend && trend.dataPoints && trend.dataPoints.length > 0 && (
        <div className="mb-3 h-10">
          <TrendSparkline
            data={trend.dataPoints}
            color={
              trend.direction === "up"
                ? "#10b981"
                : trend.direction === "down"
                ? "#ef4444"
                : "#6b7280"
            }
            height={40}
          />
        </div>
      )}

      {insight && (
        <div className={`text-xs mt-2 p-2 rounded ${severityTextColors[severity]}`}>
          <p className="font-medium">{insight}</p>
        </div>
      )}

      {action && (
        <button
          onClick={action.onClick}
          className="mt-3 w-full text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
