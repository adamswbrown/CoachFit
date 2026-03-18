import Papa from "papaparse"

export interface ParsedCronometerRow {
  date: string // YYYY-MM-DD
  calories?: number | null
  proteinGrams?: number | null
  carbsGrams?: number | null
  fatGrams?: number | null
  fiberGrams?: number | null
  weightLbs?: number | null
}

export interface CronometerParseResult {
  rows: ParsedCronometerRow[]
  unmappedColumns: string[]
  warnings: string[]
  totalRowsInFile: number
}

// Column mapping patterns — flexible matching for Cronometer CSV headers
// Cronometer's exact headers aren't publicly documented, so we match broadly
const COLUMN_PATTERNS: {
  field: keyof Omit<ParsedCronometerRow, "date">
  patterns: RegExp[]
}[] = [
  {
    field: "calories",
    patterns: [/^energy\s*\(kcal\)$/i, /^calories$/i, /^energy$/i, /^kcal$/i],
  },
  {
    field: "proteinGrams",
    patterns: [/^protein\s*\(g\)$/i, /^protein$/i],
  },
  {
    field: "carbsGrams",
    patterns: [/^carbs?\s*\(g\)$/i, /^carbohydrates?\s*\(g\)$/i, /^carbs?$/i, /^carbohydrates?$/i, /^net\s+carbs?\s*\(g\)$/i],
  },
  {
    field: "fatGrams",
    patterns: [/^fat\s*\(g\)$/i, /^total\s+fat\s*\(g\)$/i, /^fat$/i],
  },
  {
    field: "fiberGrams",
    patterns: [/^fiber\s*\(g\)$/i, /^fibre\s*\(g\)$/i, /^dietary\s+fiber\s*\(g\)$/i, /^fiber$/i, /^fibre$/i],
  },
]

const DATE_PATTERNS = [/^date$/i, /^day$/i]

function matchColumn(
  header: string,
  patterns: RegExp[]
): boolean {
  const trimmed = header.trim()
  return patterns.some((p) => p.test(trimmed))
}

function parseNumeric(value: string | undefined | null): number | null {
  if (value === undefined || value === null || value === "") return null
  const num = parseFloat(value)
  return isNaN(num) ? null : num
}

function normalizeDate(value: string): string | null {
  const trimmed = value.trim()

  // Try YYYY-MM-DD directly
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  // Try MM/DD/YYYY or M/D/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, m, d, y] = slashMatch
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`
  }

  // Try parsing as Date object as fallback
  const parsed = new Date(trimmed)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split("T")[0]
  }

  return null
}

export function parseCronometerDailyNutrition(
  csvText: string
): CronometerParseResult {
  const warnings: string[] = []
  const unmappedColumns: string[] = []

  const parseResult = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  if (parseResult.errors.length > 0) {
    const criticalErrors = parseResult.errors.filter(
      (e) => e.type === "Delimiter" || e.type === "Quotes"
    )
    if (criticalErrors.length > 0) {
      warnings.push(
        `CSV parsing errors: ${criticalErrors.map((e) => e.message).join("; ")}`
      )
    }
  }

  const headers = parseResult.meta.fields || []
  if (headers.length === 0) {
    return { rows: [], unmappedColumns: [], warnings: ["No columns found in CSV"], totalRowsInFile: 0 }
  }

  // Find the date column
  const dateCol = headers.find((h) => matchColumn(h, DATE_PATTERNS))
  if (!dateCol) {
    return {
      rows: [],
      unmappedColumns: headers,
      warnings: ["Could not find a Date column. Expected a column named 'Date' or 'Day'."],
      totalRowsInFile: parseResult.data.length,
    }
  }

  // Map nutrition columns
  const columnMap: Record<string, keyof Omit<ParsedCronometerRow, "date">> = {}
  const mappedHeaders = new Set<string>([dateCol])

  for (const header of headers) {
    if (header === dateCol) continue
    for (const { field, patterns } of COLUMN_PATTERNS) {
      if (matchColumn(header, patterns) && !Object.values(columnMap).includes(field)) {
        columnMap[header] = field
        mappedHeaders.add(header)
        break
      }
    }
  }

  // Track unmapped columns
  for (const header of headers) {
    if (!mappedHeaders.has(header)) {
      unmappedColumns.push(header)
    }
  }

  if (Object.keys(columnMap).length === 0) {
    warnings.push(
      "No nutrition columns were matched. Expected columns like 'Energy (kcal)', 'Protein (g)', 'Carbs (g)', 'Fat (g)', 'Fiber (g)'."
    )
  }

  // Parse rows
  const rows: ParsedCronometerRow[] = []
  const data = parseResult.data as Record<string, string>[]

  for (let i = 0; i < data.length; i++) {
    const raw = data[i]
    const dateValue = raw[dateCol]
    if (!dateValue) {
      warnings.push(`Row ${i + 1}: missing date, skipped`)
      continue
    }

    const normalizedDate = normalizeDate(dateValue)
    if (!normalizedDate) {
      warnings.push(`Row ${i + 1}: could not parse date "${dateValue}", skipped`)
      continue
    }

    const row: ParsedCronometerRow = { date: normalizedDate }

    for (const [csvCol, field] of Object.entries(columnMap)) {
      const val = parseNumeric(raw[csvCol])
      if (val !== null && val >= 0) {
        ;(row as any)[field] = field === "calories" ? Math.round(val) : val
      }
    }

    // Only include rows that have at least one nutrition value
    const hasData = Object.keys(row).some((k) => k !== "date" && (row as any)[k] != null)
    if (hasData) {
      rows.push(row)
    }
  }

  return {
    rows,
    unmappedColumns,
    warnings,
    totalRowsInFile: data.length,
  }
}
