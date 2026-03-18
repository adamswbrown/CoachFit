"use client"

interface NumericInputProps {
  value: number | string
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  label?: string
  unit?: string
  placeholder?: string
  error?: string
}

export function NumericInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
  unit,
  placeholder,
  error,
}: NumericInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numValue = parseFloat(e.target.value)
    if (!isNaN(numValue)) {
      onChange(numValue)
    } else if (e.target.value === "") {
      onChange(0)
    }
  }

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-gray-900">{label}</label>}
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={handleChange}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
          className={`w-full px-4 py-3 text-center text-lg rounded-lg border-2 transition-colors ${
            unit ? "pr-14" : "px-4"
          } ${
            error
              ? "border-red-500 bg-red-50"
              : "border-gray-300 bg-white focus:border-blue-600 focus:outline-none"
          }`}
        />
        {unit && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 font-medium">
            {unit}
          </span>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
