"use client"

import React, { useState } from 'react'
import { brandColors } from '@/lib/brand-colors'

interface CheckInFormProps {
  onSubmit?: (data: CheckInData) => void
  initialDate?: string
}

export interface CheckInData {
  date: string
  weightLbs?: number
  steps?: number
  calories?: number
  sleepQuality?: number
}

export const CheckInForm: React.FC<CheckInFormProps> = ({ 
  onSubmit,
  initialDate 
}) => {
  const today = initialDate || new Date().toISOString().split('T')[0]
  const [formData, setFormData] = useState<CheckInData>({
    date: today,
    weightLbs: 0,
    steps: 0,
    calories: 0,
    sleepQuality: undefined,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit?.(formData)
  }

  const increment = (field: keyof CheckInData) => {
    setFormData(prev => ({
      ...prev,
      [field]: ((prev[field] as number) || 0) + 1
    }))
  }

  const decrement = (field: keyof CheckInData) => {
    setFormData(prev => ({
      ...prev,
      [field]: Math.max(0, ((prev[field] as number) || 0) - 1)
    }))
  }

  return (
    <div className="bg-white rounded-lg border border-neutral-200 p-6 mb-6" style={{ minHeight: 'fit-content' }}>
      <h2 className="text-xl font-semibold mb-6" style={{ color: brandColors.darkBlue }}>
        Log Your Check-In
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date Field */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: brandColors.darkBlue }}>
            Date
          </label>
          <input
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1"
            style={{ 
              focusRingColor: brandColors.orange,
            }}
          />
        </div>

        {/* Weight Field */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: brandColors.darkBlue }}>
            Weight <span className="text-neutral-500 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              value={formData.weightLbs || ''}
              onChange={(e) => setFormData({ ...formData, weightLbs: parseFloat(e.target.value) || 0 })}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1"
              style={{ 
                focusRingColor: brandColors.orange,
              }}
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => increment('weightLbs')}
                className="w-6 h-6 flex items-center justify-center border border-neutral-300 rounded text-xs hover:bg-neutral-50"
                style={{ color: brandColors.darkBlue }}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => decrement('weightLbs')}
                className="w-6 h-6 flex items-center justify-center border border-neutral-300 rounded text-xs hover:bg-neutral-50"
                style={{ color: brandColors.darkBlue }}
              >
                ↓
              </button>
            </div>
            <span className="text-sm text-neutral-600">lbs</span>
          </div>
        </div>

        {/* Steps Field */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: brandColors.darkBlue }}>
            Steps <span className="text-neutral-500 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={formData.steps || ''}
              onChange={(e) => setFormData({ ...formData, steps: parseInt(e.target.value) || 0 })}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1"
              style={{ 
                focusRingColor: brandColors.orange,
              }}
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => increment('steps')}
                className="w-6 h-6 flex items-center justify-center border border-neutral-300 rounded text-xs hover:bg-neutral-50"
                style={{ color: brandColors.darkBlue }}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => decrement('steps')}
                className="w-6 h-6 flex items-center justify-center border border-neutral-300 rounded text-xs hover:bg-neutral-50"
                style={{ color: brandColors.darkBlue }}
              >
                ↓
              </button>
            </div>
            <span className="text-sm text-neutral-600">steps</span>
          </div>
        </div>

        {/* Calories Field */}
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: brandColors.darkBlue }}>
            Calories <span className="text-neutral-500 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={formData.calories || ''}
              onChange={(e) => setFormData({ ...formData, calories: parseInt(e.target.value) || 0 })}
              className="flex-1 px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1"
              style={{ 
                focusRingColor: brandColors.orange,
              }}
            />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => increment('calories')}
                className="w-6 h-6 flex items-center justify-center border border-neutral-300 rounded text-xs hover:bg-neutral-50"
                style={{ color: brandColors.darkBlue }}
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => decrement('calories')}
                className="w-6 h-6 flex items-center justify-center border border-neutral-300 rounded text-xs hover:bg-neutral-50"
                style={{ color: brandColors.darkBlue }}
              >
                ↓
              </button>
            </div>
            <span className="text-sm text-neutral-600">kcal</span>
          </div>
        </div>

        {/* Sleep Quality Field */}
        <div className="pb-2">
          <label className="block text-sm font-medium mb-2" style={{ color: brandColors.darkBlue }}>
            Sleep Quality <span className="text-neutral-500 font-normal">(optional, 1-10)</span>
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={formData.sleepQuality || ''}
            onChange={(e) => setFormData({ ...formData, sleepQuality: parseInt(e.target.value) || undefined })}
            className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1"
            style={{ 
              focusRingColor: brandColors.orange,
            }}
            placeholder="1-10"
          />
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            className="w-full px-6 py-3 rounded-md font-medium text-white transition-colors"
            style={{ backgroundColor: brandColors.orange }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e55a2b'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = brandColors.orange}
          >
            Submit Check-In
          </button>
        </div>
      </form>
    </div>
  )
}
