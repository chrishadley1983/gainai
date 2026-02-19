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
  content_type: string
  title: string
  body: string
  scheduled_at: string
  valid: boolean
  errors: string[]
}

const TEMPLATE_CSV = `client_slug,content_type,title,body,scheduled_at,cta_type,cta_url
my-business,STANDARD,Weekly Update,"Check out what's new this week!",2026-03-01T10:00:00Z,LEARN_MORE,https://example.com
my-business,OFFER,Spring Sale,"50% off all items this weekend!",2026-03-05T09:00:00Z,SHOP,https://example.com/sale`

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
    accessorKey: 'content_type',
    header: 'Type',
    cell: ({ row }) => (
      <Badge variant="outline" className="capitalize text-xs">
        {row.original.content_type?.toLowerCase().replace('_', ' ') || '-'}
      </Badge>
    ),
  },
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => (
      <span className="line-clamp-1 max-w-[200px]">{row.original.title}</span>
    ),
  },
  {
    accessorKey: 'scheduled_at',
    header: 'Scheduled',
    cell: ({ row }) => {
      const d = row.original.scheduled_at
      return d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
    },
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

export default function PostsImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [validationResults, setValidationResults] = useState<ValidationRow[]>([])
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importComplete, setImportComplete] = useState(false)

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'post-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleFileDrop(files: File[]) {
    if (files.length === 0) return
    const f = files[0]
    setFile(f)
    setImportComplete(false)
    setValidating(true)

    const text = await f.text()
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 2) {
      setValidationResults([])
      setValidating(false)
      return
    }

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
    const VALID_TYPES = ['STANDARD', 'EVENT', 'OFFER', 'PRODUCT', 'ALERT']

    const results: ValidationRow[] = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim().replace(/^"|"$/g, ''))
      const rowData: Record<string, string> = {}
      headers.forEach((h, idx) => {
        rowData[h] = values[idx] || ''
      })

      const errors: string[] = []

      if (!rowData.client_slug) errors.push('Missing client_slug')
      if (!rowData.body && !rowData.summary) errors.push('Missing body/summary')
      if (rowData.content_type && !VALID_TYPES.includes(rowData.content_type.toUpperCase())) {
        errors.push(`Invalid content_type: ${rowData.content_type}`)
      }
      if (rowData.scheduled_at && isNaN(Date.parse(rowData.scheduled_at))) {
        errors.push('Invalid scheduled_at date')
      }

      results.push({
        row: i,
        client_slug: rowData.client_slug || '',
        content_type: (rowData.content_type || 'STANDARD').toUpperCase(),
        title: rowData.title || '',
        body: rowData.body || rowData.summary || '',
        scheduled_at: rowData.scheduled_at || '',
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

    // Resolve client slugs to IDs
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
        content_type: r.content_type,
        title: r.title || null,
        summary: r.body,
        status: r.scheduled_at ? 'SCHEDULED' : 'DRAFT',
        scheduled_at: r.scheduled_at || null,
      }))

    if (inserts.length > 0) {
      await supabase.from('posts').insert(inserts)
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
          <h1 className="text-2xl font-bold tracking-tight">Import Posts</h1>
          <p className="text-sm text-muted-foreground">
            Bulk import posts from a CSV file
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
            <span className="text-sm text-muted-foreground">
              {validationResults.length} total rows
            </span>
          </div>

          <DataTable columns={validationColumns} data={validationResults} pageSize={20} />

          <div className="flex items-center gap-3">
            {importComplete ? (
              <div className="flex items-center gap-2 text-emerald-600">
                <Check className="h-5 w-5" />
                <span className="font-medium">
                  Import complete! {validCount} posts imported successfully.
                </span>
              </div>
            ) : (
              <Button
                onClick={handleImport}
                disabled={importing || validCount === 0}
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-1" />
                    Import {validCount} Valid Posts
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
