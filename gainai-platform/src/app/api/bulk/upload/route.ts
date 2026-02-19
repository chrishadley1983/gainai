import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Papa from 'papaparse'

// Column definitions for each job type
const COLUMN_SCHEMAS: Record<string, { required: string[]; optional: string[] }> = {
  client: {
    required: ['name', 'contact_email'],
    optional: ['slug', 'contact_name', 'contact_phone', 'website_url', 'package_type', 'notes'],
  },
  location: {
    required: ['client_id', 'name', 'address'],
    optional: ['phone', 'website_url', 'primary_category', 'timezone', 'latitude', 'longitude'],
  },
  post: {
    required: ['location_id', 'summary', 'content_type'],
    optional: ['title', 'scheduled_at', 'call_to_action_type', 'call_to_action_url', 'media_urls'],
  },
  media: {
    required: ['location_id', 'url', 'media_type', 'category'],
    optional: ['file_name', 'description'],
  },
  competitor: {
    required: ['client_id', 'name', 'place_id'],
    optional: ['address', 'phone', 'website_url', 'primary_category', 'notes'],
  },
}

const VALID_CONTENT_TYPES = ['STANDARD', 'EVENT', 'OFFER', 'PRODUCT', 'ALERT']
const VALID_PACKAGE_TYPES = ['STARTER', 'GROWTH', 'PREMIUM', 'ENTERPRISE']
const VALID_MEDIA_CATEGORIES = ['COVER', 'PROFILE', 'ADDITIONAL', 'POST']

interface ValidationRow {
  rowIndex: number
  data: Record<string, string>
  status: 'valid' | 'warning' | 'error'
  errors: string[]
  warnings: string[]
}

function validateRow(
  row: Record<string, string>,
  rowIndex: number,
  jobType: string,
  schema: { required: string[]; optional: string[] }
): ValidationRow {
  const errors: string[] = []
  const warnings: string[] = []

  // Check required columns
  for (const col of schema.required) {
    const value = row[col]?.trim()
    if (!value) {
      errors.push(`Missing required field: ${col}`)
    }
  }

  // Type-specific validations
  if (jobType === 'client') {
    if (row.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.contact_email.trim())) {
      errors.push('Invalid email format for contact_email')
    }
    if (row.package_type && !VALID_PACKAGE_TYPES.includes(row.package_type.trim().toUpperCase())) {
      warnings.push(`package_type "${row.package_type}" is not standard; will default to STARTER`)
    }
    if (row.website_url && !row.website_url.trim().startsWith('http')) {
      warnings.push('website_url should start with http:// or https://')
    }
  }

  if (jobType === 'location') {
    if (row.latitude && isNaN(parseFloat(row.latitude))) {
      errors.push('latitude must be a valid number')
    }
    if (row.longitude && isNaN(parseFloat(row.longitude))) {
      errors.push('longitude must be a valid number')
    }
  }

  if (jobType === 'post') {
    if (row.content_type && !VALID_CONTENT_TYPES.includes(row.content_type.trim().toUpperCase())) {
      errors.push(`Invalid content_type: ${row.content_type}. Must be one of: ${VALID_CONTENT_TYPES.join(', ')}`)
    }
    if (row.summary && row.summary.trim().length > 1500) {
      warnings.push('summary exceeds 1500 characters and may be truncated by Google')
    }
    if (row.scheduled_at && isNaN(Date.parse(row.scheduled_at))) {
      errors.push('scheduled_at must be a valid date/time string')
    }
  }

  if (jobType === 'media') {
    if (row.category && !VALID_MEDIA_CATEGORIES.includes(row.category.trim().toUpperCase())) {
      errors.push(`Invalid category: ${row.category}. Must be one of: ${VALID_MEDIA_CATEGORIES.join(', ')}`)
    }
    if (row.url && !row.url.trim().startsWith('http')) {
      errors.push('url must be a valid HTTP(S) URL')
    }
  }

  // Warn on unknown columns
  const knownCols = new Set([...schema.required, ...schema.optional])
  for (const key of Object.keys(row)) {
    if (!knownCols.has(key) && key.trim() !== '') {
      warnings.push(`Unknown column "${key}" will be ignored`)
    }
  }

  const status = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid'

  return { rowIndex, data: row, status, errors, warnings }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      )
    }

    // Verify user is a team member
    const { data: teamMember, error: teamError } = await supabase
      .from('team_members')
      .select('id, role')
      .eq('user_id', user.id)
      .single()

    if (teamError || !teamMember) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Admin access required' } },
        { status: 403 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const jobType = formData.get('jobType') as string | null

    if (!file) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'file is required' } },
        { status: 400 }
      )
    }

    if (!jobType) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'jobType is required' } },
        { status: 400 }
      )
    }

    const schema = COLUMN_SCHEMAS[jobType]
    if (!schema) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: `Invalid jobType: ${jobType}. Must be one of: ${Object.keys(COLUMN_SCHEMAS).join(', ')}` } },
        { status: 400 }
      )
    }

    // Read file content
    const text = await file.text()

    if (!text.trim()) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'CSV file is empty' } },
        { status: 400 }
      )
    }

    // Parse CSV
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header: string) => header.trim().toLowerCase().replace(/\s+/g, '_'),
    })

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: 'Failed to parse CSV file',
            details: { errors: parsed.errors.slice(0, 10) },
          },
        },
        { status: 400 }
      )
    }

    if (parsed.data.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'CSV file contains no data rows' } },
        { status: 400 }
      )
    }

    // Validate all rows
    const validatedRows: ValidationRow[] = parsed.data.map((row, index) =>
      validateRow(row, index + 1, jobType, schema)
    )

    const validCount = validatedRows.filter((r) => r.status === 'valid').length
    const warningCount = validatedRows.filter((r) => r.status === 'warning').length
    const errorCount = validatedRows.filter((r) => r.status === 'error').length

    // Create a bulk job record
    const { data: job, error: jobError } = await supabase
      .from('bulk_jobs')
      .insert({
        type: jobType.toUpperCase() as string,
        status: 'PENDING',
        total_items: parsed.data.length,
        processed_items: 0,
        failed_items: 0,
        created_by_id: user.id,
        metadata: {
          file_name: file.name,
          file_size: file.size,
          valid_count: validCount,
          warning_count: warningCount,
          error_count: errorCount,
        },
      })
      .select()
      .single()

    if (jobError) {
      console.error('Failed to create bulk job:', jobError)
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Failed to create bulk job record' } },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          jobId: job.id,
          jobType,
          totalRows: parsed.data.length,
          validCount,
          warningCount,
          errorCount,
          rows: validatedRows,
          parseWarnings: parsed.errors.length > 0
            ? parsed.errors.slice(0, 10).map((e) => e.message)
            : [],
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Bulk upload error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
