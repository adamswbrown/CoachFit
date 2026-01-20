"use client"

import { useState } from "react"

interface DatePickerProps {
  value: string
  onChange: (date: string) => void
  format: string
  error?: string
}

export function DatePicker({ value, onChange, format, error }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedDate = e.target.value
    if (selectedDate) {
      onChange(selectedDate)
    }
  }

  const formatDisplay = (dateString: string) => {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US")
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-900">Birth Date</label>
      <div className="flex gap-2">
        <input
          type="date"
          value={value}
          onChange={handleDateChange}
          className={`flex-1 px-4 py-3 rounded-lg border-2 transition-colors ${
            error
              ? "border-red-500 bg-red-50"
              : "border-gray-300 bg-white focus:border-blue-600 focus:outline-none"
          }`}
        />
      </div>
      {value && (
        <p className="text-sm text-gray-600">
          Format: {format}
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
