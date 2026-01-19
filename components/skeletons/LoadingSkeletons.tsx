/**
 * Loading skeleton components for improved perceived performance
 */

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-200">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="text-left p-3">
                <div className="h-4 bg-neutral-200 rounded animate-pulse w-24"></div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx} className="border-b border-neutral-100">
              {Array.from({ length: columns }).map((_, colIdx) => (
                <td key={colIdx} className="p-3">
                  <div className="h-4 bg-neutral-100 rounded animate-pulse w-32"></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function MetricCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6 animate-pulse">
      <div className="h-4 bg-neutral-200 rounded w-24 mb-3"></div>
      <div className="h-8 bg-neutral-200 rounded w-16 mb-2"></div>
      <div className="h-3 bg-neutral-100 rounded w-32"></div>
    </div>
  )
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6 animate-pulse">
      <div className="h-4 bg-neutral-200 rounded w-20 mb-2"></div>
      <div className="h-10 bg-neutral-200 rounded w-12"></div>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="h-8 bg-neutral-200 rounded w-48 mb-2 animate-pulse"></div>
        <div className="h-4 bg-neutral-100 rounded w-64 animate-pulse"></div>
      </div>

      {/* Stats Grid Skeleton */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="bg-white rounded-lg border border-neutral-200 p-6">
        <div className="h-6 bg-neutral-200 rounded w-32 mb-4 animate-pulse"></div>
        <TableSkeleton rows={8} columns={5} />
      </div>
    </div>
  )
}

export function OverviewSkeleton() {
  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Skeleton */}
      <div className="mb-8">
        <div className="h-8 bg-neutral-200 rounded w-48 mb-2 animate-pulse"></div>
        <div className="h-4 bg-neutral-100 rounded w-64 animate-pulse"></div>
      </div>

      {/* Metrics Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {Array.from({ length: 6 }).map((_, i) => (
          <MetricCardSkeleton key={i} />
        ))}
      </div>

      {/* Quick Actions Skeleton */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6">
        <div className="h-6 bg-neutral-200 rounded w-32 mb-4 animate-pulse"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-4 border border-neutral-200 rounded-lg animate-pulse">
              <div className="h-5 bg-neutral-200 rounded w-20 mb-2"></div>
              <div className="h-4 bg-neutral-100 rounded w-12"></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
