'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { DataTable } from '@/components/shared/DataTable'
import {
  Download,
  Upload,
  Check,
  X,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

interface ValidationRow {
  row: number
  client_slug: string
  name: string
  address: string
  phone: string
  website_url: string
  primary_category: string
  valid: boolean
  errors: string[]
}

const TEMPLATE_CSV = `client_slug,name,address,phone,website_url,primary_category
my-business,Main Branch,"123 High Street, London, EC1A 1BB",020 1234 5678,https://example.com,Restaurant
my-business,West End,"456 Oxford Street, London, W1D 1BS",020 9876 5432,https://example.com/west-end,Restaurant`

const validationColumns: ColumnDef<ValidationRow, unknown>[] = [
  {
    accessorKey: 'row',
    header: 'Row',
    cell: ({ row }) => <span className="font-mono text-xs">{row.original.row}</span>,
  },
  {
    accessorKey: 'client_slug',
    header: 'Client',
  },
  {
    accessorKey: 'name',
    header: 'Location Name',
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) => (
      <span className="line-clamp-1 max-w-[200px] text-sm">{row.original.address}</span>
    ),
  },
  {
    accessorKey: 'primary_category',
    header: 'Category',
  },
  {
    accessorKey: 'valid',
    header: 'Status',
    cell: ({ row }) =>
      row.original.valid ? (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
          <Check className="h-3 w-3 mr-1" />
          Valid
        </Badge>
      ) : (
        <Badge className="bg-red-100 text-red-800 border-red-200">
          <X className="h-3 w-3 mr-1" />
          Invalid
        </Badge>
      ),
  },
  {
    accessorKey: 'errors',
    header: 'Errors',
    cell: ({ row }) =>
      row.original.errors.length > 0 ? (
        <span className="text-xs text-red-600">{row.original.errors.join('; ')}</span>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      ),
  },
]

export default function LocationsImportPage() {
  const [validationResults, setValidationResults] = useState<ValidationRow[]>([])
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importComplete, setImportComplete] = useState(false)

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'location-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileDrop(files: File[]) {
    if (files.length === 0) return
    setImportComplete(false)
    setValidating(true)

    const text = await files[0].text()
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 2) {
      setValidationResults([])
      setValidating(false)
      return
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''))
    const results: ValidationRow[] = []

    for (let i = 1; i < lines.length; i++) {
      // Simple CSV parsing (handles quoted fields)
      const values: string[] = []
      let current = ''
      let inQuotes = false
      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      values.push(current.trim())

      const rowData: Record<string, string> = {}
      headers.forEach((h, idx) => {
        rowData[h] = values[idx] || ''
      })

      const errors: string[] = []
      if (!rowData.client_slug) errors.push('Missing client_slug')
      if (!rowData.name) errors.push('Missing name')
      if (!rowData.address) errors.push('Missing address')

      results.push({
        row: i,
        client_slug: rowData.client_slug || '',
        name: rowData.name || '',
        address: rowData.address || '',
        phone: rowData.phone || '',
        website_url: rowData.website_url || '',
        primary_category: rowData.primary_category || '',
        valid: errors.length === 0,
        errors,
      })
    }

    setValidationResults(results)
    setValidating(false)
  }

  async function handleImport() {
    setImporting(true)

    const validRows = validationResults.filter((r) => r.valid)
    const supabase = createClient()

    const slugs = [...new Set(validRows.map((r) => r.client_slug))]
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, slug')
      .in('slug', slugs)

    const slugToId: Record<string, string> = {}
    clientData?.forEach((c: any) => {
      slugToId[c.slug] = c.id
    })

    const inserts = validRows
      .filter((r) => slugToId[r.client_slug])
      .map((r) => ({
        client_id: slugToId[r.client_slug],
        name: r.name,
        address: r.address,
        phone: r.phone || null,
        website_url: r.website_url || null,
        primary_category: r.primary_category || null,
        status: 'PENDING_VERIFICATION',
      }))

    if (inserts.length > 0) {
      await supabase.from('gbp_locations').insert(inserts)
    }

    setImporting(false)
    setImportComplete(true)
  }

  const validCount = validationResults.filter((r) => r.valid).length
  const invalidCount = validationResults.filter((r) => !r.valid).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Locations</h1>
          <p className="text-sm text-muted-foreground">
            Bulk import locations from a CSV file
          </p>
        </div>
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="h-4 w-4 mr-1" />
          Download Template
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload CSV File</CardTitle>
        </CardHeader>
        <CardContent>
          <FileDropzone
            accept=".csv,text/csv"
            maxSize={5 * 1024 * 1024}
            onDrop={handleFileDrop}
          />
        </CardContent>
      </Card>

      {validating && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            <span className="text-sm">Validating CSV data...</span>
          </CardContent>
        </Card>
      )}

      {validationResults.length > 0 && !validating && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
              <Check className="h-3 w-3 mr-1" />
              {validCount} valid
            </Badge>
            {invalidCount > 0 && (
              <Badge className="bg-red-100 text-red-800 border-red-200">
                <AlertCircle className="h-3 w-3 mr-1" />
                {invalidCount} invalid
              </Badge>
            )}
          </div>

          <DataTable columns={validationColumns} data={validationResults} pageSize={20} />

          <div className="flex items-center gap-3">
            {importComplete ? (
              <div className="flex items-center gap-2 text-emerald-600">
                <Check className="h-5 w-5" />
                <span className="font-medium">
                  Import complete! {validCount} locations imported.
                </span>
              </div>
            ) : (
              <Button onClick={handleImport} disabled={importing || validCount === 0}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-1" />
                    Import {validCount} Valid Locations
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
