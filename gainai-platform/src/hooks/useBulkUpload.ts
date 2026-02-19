'use client'

import { useState, useCallback } from 'react'
import Papa from 'papaparse'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  rowIndex: number
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface ParsedData {
  headers: string[]
  rows: Record<string, string>[]
}

export interface BulkUploadProgress {
  total: number
  processed: number
  succeeded: number
  failed: number
  percentage: number
}

export type BulkUploadPhase = 'idle' | 'parsing' | 'validating' | 'processing' | 'complete' | 'error'

// ---------------------------------------------------------------------------
// useBulkUpload – manages the full bulk upload lifecycle
// ---------------------------------------------------------------------------

export function useBulkUpload(jobType: string) {
  const [phase, setPhase] = useState<BulkUploadPhase>('idle')
  const [parsedData, setParsedData] = useState<ParsedData | null>(null)
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([])
  const [progress, setProgress] = useState<BulkUploadProgress>({
    total: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    percentage: 0,
  })
  const [error, setError] = useState<string | null>(null)

  // -------------------------------------------------------------------------
  // Upload and parse a CSV file
  // -------------------------------------------------------------------------

  const uploadFile = useCallback(async (file: File): Promise<ParsedData | null> => {
    setPhase('parsing')
    setError(null)
    setValidationResults([])
    setProgress({ total: 0, processed: 0, succeeded: 0, failed: 0, percentage: 0 })

    return new Promise((resolve) => {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
        complete: (results) => {
          if (results.errors.length > 0) {
            const parseErrors = results.errors
              .map((e) => `Row ${e.row ?? '?'}: ${e.message}`)
              .join('; ')
            setError(`CSV parse errors: ${parseErrors}`)
            setPhase('error')
            resolve(null)
            return
          }

          const headers = results.meta.fields ?? []
          const rows = results.data

          const data: ParsedData = { headers, rows }
          setParsedData(data)
          setPhase('idle')
          resolve(data)
        },
        error: (err) => {
          setError(`Failed to parse CSV: ${err.message}`)
          setPhase('error')
          resolve(null)
        },
      })
    })
  }, [])

  // -------------------------------------------------------------------------
  // Validate parsed rows using a provided validator function
  // -------------------------------------------------------------------------

  const validateRows = useCallback(
    async (
      rows: Record<string, string>[],
      validator: (row: Record<string, string>, index: number) => ValidationResult
    ): Promise<ValidationResult[]> => {
      setPhase('validating')
      setError(null)

      try {
        const results = rows.map((row, index) => validator(row, index))
        setValidationResults(results)
        setPhase('idle')
        return results
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Validation failed'
        setError(message)
        setPhase('error')
        return []
      }
    },
    []
  )

  // -------------------------------------------------------------------------
  // Process validated rows using a provided processor function
  // -------------------------------------------------------------------------

  const processRows = useCallback(
    async (
      rows: Record<string, string>[],
      processor: (
        row: Record<string, string>,
        index: number
      ) => Promise<{ success: boolean; error?: string }>
    ): Promise<BulkUploadProgress> => {
      setPhase('processing')
      setError(null)

      const total = rows.length
      let processed = 0
      let succeeded = 0
      let failed = 0

      setProgress({ total, processed, succeeded, failed, percentage: 0 })

      for (let i = 0; i < rows.length; i++) {
        try {
          const result = await processor(rows[i], i)
          processed++

          if (result.success) {
            succeeded++
          } else {
            failed++
          }
        } catch {
          processed++
          failed++
        }

        const percentage = Math.round((processed / total) * 100)
        setProgress({ total, processed, succeeded, failed, percentage })
      }

      const finalProgress = { total, processed, succeeded, failed, percentage: 100 }
      setProgress(finalProgress)
      setPhase('complete')
      return finalProgress
    },
    []
  )

  // -------------------------------------------------------------------------
  // Reset the entire upload state
  // -------------------------------------------------------------------------

  const reset = useCallback(() => {
    setPhase('idle')
    setParsedData(null)
    setValidationResults([])
    setProgress({ total: 0, processed: 0, succeeded: 0, failed: 0, percentage: 0 })
    setError(null)
  }, [])

  return {
    jobType,
    phase,
    parsedData,
    validationResults,
    progress,
    error,
    uploadFile,
    validateRows,
    processRows,
    reset,
  }
}
