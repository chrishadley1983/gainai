import Papa from 'papaparse'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParseResult {
  headers: string[]
  rows: Record<string, string>[]
}

// ---------------------------------------------------------------------------
// parseCSV – parse a CSV file into headers and rows
// ---------------------------------------------------------------------------

/**
 * Parse a CSV file into structured data using PapaParse.
 *
 * @param file - The CSV File object to parse.
 * @returns An object containing the headers array and an array of row objects.
 */
export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          const errorMessages = results.errors
            .slice(0, 10)
            .map((e) => `Row ${e.row ?? '?'}: ${e.message}`)
            .join('; ')
          reject(new Error(`CSV parse errors: ${errorMessages}`))
          return
        }

        const headers = results.meta.fields ?? []
        resolve({ headers, rows: results.data })
      },
      error: (err) => {
        reject(new Error(`Failed to parse CSV: ${err.message}`))
      },
    })
  })
}

// ---------------------------------------------------------------------------
// parseXLSX – parse an XLSX file into headers and rows
// ---------------------------------------------------------------------------

/**
 * Parse an XLSX (Excel) file into structured data.
 *
 * Dynamically imports the `xlsx` package to keep it tree-shaken when not used.
 *
 * @param file - The XLSX File object to parse.
 * @param sheetIndex - Optional sheet index (defaults to 0, the first sheet).
 * @returns An object containing the headers array and an array of row objects.
 */
export async function parseXLSX(
  file: File,
  sheetIndex = 0
): Promise<ParseResult> {
  // Dynamic import to keep xlsx out of client bundles when unused
  const XLSX = await import('xlsx')

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })

  const sheetNames = workbook.SheetNames
  if (sheetIndex >= sheetNames.length) {
    throw new Error(
      `Sheet index ${sheetIndex} is out of range. Workbook has ${sheetNames.length} sheet(s).`
    )
  }

  const sheet = workbook.Sheets[sheetNames[sheetIndex]]
  const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  })

  if (jsonData.length === 0) {
    return { headers: [], rows: [] }
  }

  // Extract headers from the first row's keys
  const headers = Object.keys(jsonData[0]).map((h) => h.trim())

  // Convert all values to strings for consistency with CSV parsing
  const rows = jsonData.map((row) => {
    const stringRow: Record<string, string> = {}
    for (const key of headers) {
      const value = row[key]
      stringRow[key] = value !== null && value !== undefined ? String(value) : ''
    }
    return stringRow
  })

  return { headers, rows }
}
