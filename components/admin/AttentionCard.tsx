"use client"

import Link from "next/link"
import type { AttentionQueueItem } from "@/lib/admin/attention"

interface AttentionCardProps {
  item: AttentionQueueItem
  onAction?: (item: AttentionQueueItem, action: string) => void
}

export function AttentionCard({ item, onAction }: AttentionCardProps) {
  const priorityColors = {
    red: "border-red-300 bg-red-50",
    amber: "border-amber-300 bg-amber-50",
    green: "border-green-300 bg-green-50",
  }

  const priorityBadgeColors = {
    red: "bg-red-600 text-white",
    amber: "bg-amber-600 text-white",
    green: "bg-green-600 text-white",
  }

  const priorityLabels = {
    red: "Needs Attention",
    amber: "Watch Closely",
    green: "Stable",
  }

  const getEntityUrl = () => {
    switch (item.entityType) {
      case "user":
        return `/clients/${item.entityId}?attention=1`
      case "coach":
        // Coaches are users, so route to user detail page
        return `/admin/users/${item.entityId}`
      case "cohort":
        return `/cohorts/${item.entityId}`
      default:
        return "#"
    }
  }

  return (
    <div
      className={`rounded-lg border p-4 ${priorityColors[item.priority]} hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 text-xs font-semibold rounded ${priorityBadgeColors[item.priority]}`}
          >
            {priorityLabels[item.priority]}
          </span>
          <span className="text-xs text-gray-500 uppercase">{item.entityType}</span>
        </div>
        <span className="text-xs font-semibold text-gray-700">Score: {item.score}</span>
      </div>

      <Link href={getEntityUrl()}>
        <h3 className="font-semibold text-gray-900 mb-1 hover:underline">
          {item.entityName}
        </h3>
      </Link>

      {item.entityEmail && (
        <p className="text-sm text-gray-600 mb-3">{item.entityEmail}</p>
      )}

      {item.reasons && item.reasons.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-700 mb-1">Reasons:</p>
          <ul className="list-disc list-inside space-y-1">
            {item.reasons.map((reason, idx) => (
              <li key={idx} className="text-xs text-gray-600">
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {item.suggestedActions && item.suggestedActions.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-medium text-gray-700 mb-1">Suggested Actions:</p>
          <div className="flex flex-wrap gap-1">
            {item.suggestedActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => onAction?.(item, action)}
                className="text-xs px-2 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-200 flex gap-2">
        <Link
          href={getEntityUrl()}
          className="text-xs px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
        >
          View Details
        </Link>
        {onAction && (
          <button
            onClick={() => onAction(item, "dismiss")}
            className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  )
}
