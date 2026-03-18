"use client"

interface UnitToggleProps {
  value: string
  onChange: (value: string) => void
  unit1: string
  unit1Label: string
  unit2: string
  unit2Label: string
}

export function UnitToggle({
  value,
  onChange,
  unit1,
  unit1Label,
  unit2,
  unit2Label,
}: UnitToggleProps) {
  return (
    <div className="flex gap-3">
      <button
        onClick={() => onChange(unit1)}
        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
          value === unit1
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
        }`}
      >
        {unit1Label}
      </button>
      <button
        onClick={() => onChange(unit2)}
        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
          value === unit2
            ? "bg-blue-600 text-white"
            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
        }`}
      >
        {unit2Label}
      </button>
    </div>
  )
}
