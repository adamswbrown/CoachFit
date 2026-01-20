"use client"

interface SelectionGridProps {
  options: Array<{
    id: string
    label: string
    description?: string
  }>
  value: string
  onChange: (value: string) => void
  columns?: number
}

export function SelectionGrid({
  options,
  value,
  onChange,
  columns = 2,
}: SelectionGridProps) {
  return (
    <div
      className="grid gap-3"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          className={`p-4 rounded-lg border-2 text-center transition-all ${
            value === option.id
              ? "border-blue-600 bg-blue-50"
              : "border-gray-200 bg-white hover:border-gray-400"
          }`}
        >
          <div className="font-medium text-gray-900">{option.label}</div>
          {option.description && (
            <div className="text-xs text-gray-600 mt-1">{option.description}</div>
          )}
        </button>
      ))}
    </div>
  )
}
