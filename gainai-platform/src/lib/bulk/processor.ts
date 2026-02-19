import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProcessResult {
  totalRows: number
  successCount: number
  errorCount: number
  errors: ProcessError[]
}

export interface ProcessError {
  rowIndex: number
  message: string
}

type Row = Record<string, string>

// ---------------------------------------------------------------------------
// processClientImport – insert validated client rows into the database
// ---------------------------------------------------------------------------

/**
 * Process and insert validated client rows.
 *
 * @param rows - Array of validated row objects from CSV/XLSX parsing.
 * @param orgId - The organisation ID to assign to all imported clients.
 */
export async function processClientImport(
  rows: Row[],
  orgId: string
): Promise<ProcessResult> {
  const supabase = createAdminClient()
  const errors: ProcessError[] = []
  let successCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    try {
      const payload: Record<string, unknown> = {
        organisation_id: orgId,
        name: row.name.trim(),
        slug: row.slug.trim().toLowerCase(),
        status: (row.status?.trim().toUpperCase() || 'ONBOARDING'),
      }

      // Optional fields
      if (row.contact_name?.trim()) payload.contact_name = row.contact_name.trim()
      if (row.contact_email?.trim()) payload.contact_email = row.contact_email.trim()
      if (row.contact_phone?.trim()) payload.contact_phone = row.contact_phone.trim()
      if (row.industry?.trim()) payload.industry = row.industry.trim()
      if (row.website?.trim()) payload.website = row.website.trim()
      if (row.package?.trim()) payload.package = row.package.trim().toUpperCase()
      if (row.monthly_fee?.trim()) payload.monthly_fee = parseFloat(row.monthly_fee.trim())
      if (row.notes?.trim()) payload.notes = row.notes.trim()
      if (row.tags?.trim()) {
        payload.tags = row.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      }

      const { error } = await supabase.from('clients').insert(payload)

      if (error) {
        throw new Error(error.message)
      }

      successCount++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      errors.push({ rowIndex: i, message })
    }
  }

  return {
    totalRows: rows.length,
    successCount,
    errorCount: errors.length,
    errors,
  }
}

// ---------------------------------------------------------------------------
// processLocationImport – insert validated location rows into the database
// ---------------------------------------------------------------------------

/**
 * Process and insert validated location rows.
 *
 * @param rows - Array of validated row objects.
 */
export async function processLocationImport(rows: Row[]): Promise<ProcessResult> {
  const supabase = createAdminClient()
  const errors: ProcessError[] = []
  let successCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    try {
      const payload: Record<string, unknown> = {
        client_id: row.client_id.trim(),
        name: row.name.trim(),
        address: row.address.trim(),
        status: (row.status?.trim().toUpperCase() || 'PENDING_VERIFICATION'),
      }

      if (row.phone?.trim()) payload.phone = row.phone.trim()
      if (row.website?.trim()) payload.website = row.website.trim()
      if (row.primary_category?.trim()) payload.primary_category = row.primary_category.trim()
      if (row.latitude?.trim()) payload.latitude = parseFloat(row.latitude.trim())
      if (row.longitude?.trim()) payload.longitude = parseFloat(row.longitude.trim())
      if (row.timezone?.trim()) payload.timezone = row.timezone.trim()

      const { error } = await supabase.from('gbp_locations').insert(payload)

      if (error) {
        throw new Error(error.message)
      }

      successCount++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      errors.push({ rowIndex: i, message })
    }
  }

  return {
    totalRows: rows.length,
    successCount,
    errorCount: errors.length,
    errors,
  }
}

// ---------------------------------------------------------------------------
// processPostImport – insert validated post rows into the database
// ---------------------------------------------------------------------------

/**
 * Process and insert validated post rows.
 *
 * @param rows - Array of validated row objects.
 */
export async function processPostImport(rows: Row[]): Promise<ProcessResult> {
  const supabase = createAdminClient()
  const errors: ProcessError[] = []
  let successCount = 0

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]

    try {
      const payload: Record<string, unknown> = {
        client_id: row.client_id.trim(),
        location_id: row.location_id.trim(),
        body: row.body.trim(),
        content_type: row.content_type.trim().toUpperCase(),
        status: (row.status?.trim().toUpperCase() || 'DRAFT'),
      }

      if (row.title?.trim()) payload.title = row.title.trim()
      if (row.scheduled_for?.trim()) {
        payload.scheduled_for = new Date(row.scheduled_for.trim()).toISOString()
      }
      if (row.call_to_action_type?.trim()) {
        payload.call_to_action = {
          type: row.call_to_action_type.trim().toUpperCase(),
          url: row.call_to_action_url?.trim() || undefined,
        }
      }

      const { error } = await supabase.from('posts').insert(payload)

      if (error) {
        throw new Error(error.message)
      }

      successCount++
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      errors.push({ rowIndex: i, message })
    }
  }

  return {
    totalRows: rows.length,
    successCount,
    errorCount: errors.length,
    errors,
  }
}
