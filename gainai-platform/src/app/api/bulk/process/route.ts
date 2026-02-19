import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ProcessRow {
  rowIndex: number
  data: Record<string, string>
}

interface ProcessResult {
  rowIndex: number
  status: 'success' | 'error'
  id?: string
  error?: string
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

    const body = await request.json()
    const { jobId, rows } = body as { jobId: string; rows: ProcessRow[] }

    if (!jobId || typeof jobId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'jobId is required' } },
        { status: 400 }
      )
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'rows array is required and must not be empty' } },
        { status: 400 }
      )
    }

    // Fetch the job to get its type
    const { data: job, error: jobError } = await supabase
      .from('bulk_jobs')
      .select('*')
      .eq('id', jobId)
      .single()

    if (jobError || !job) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Bulk job not found' } },
        { status: 404 }
      )
    }

    if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_STATE', message: `Job is already ${job.status.toLowerCase()}` } },
        { status: 400 }
      )
    }

    // Mark job as processing
    await supabase
      .from('bulk_jobs')
      .update({
        status: 'PROCESSING',
        started_at: job.started_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    const jobType = (job.type as string).toLowerCase()
    const results: ProcessResult[] = []
    let processedCount = job.processed_items || 0
    let failedCount = job.failed_items || 0
    const errors: Array<{ itemIndex: number; message: string }> = job.errors || []

    for (const row of rows) {
      try {
        const result = await processRow(supabase, jobType, row, user.id)
        results.push(result)
        processedCount++

        if (result.status === 'error') {
          failedCount++
          errors.push({ itemIndex: row.rowIndex, message: result.error || 'Unknown error' })
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Processing failed'
        results.push({
          rowIndex: row.rowIndex,
          status: 'error',
          error: errorMessage,
        })
        processedCount++
        failedCount++
        errors.push({ itemIndex: row.rowIndex, message: errorMessage })
      }

      // Update progress every 10 rows
      if (processedCount % 10 === 0) {
        await supabase
          .from('bulk_jobs')
          .update({
            processed_items: processedCount,
            failed_items: failedCount,
            errors: errors.slice(-100), // Keep last 100 errors
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId)
      }
    }

    // Final update
    const isComplete = processedCount >= job.total_items
    await supabase
      .from('bulk_jobs')
      .update({
        status: isComplete ? 'COMPLETED' : 'PROCESSING',
        processed_items: processedCount,
        failed_items: failedCount,
        errors: errors.slice(-100),
        completed_at: isComplete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId)

    // Log activity
    await supabase.from('activity_log').insert({
      client_id: job.client_id || null,
      actor_type: 'user',
      action: 'bulk_process_batch',
      description: `Processed ${results.length} rows for bulk ${jobType} job (${results.filter((r) => r.status === 'success').length} succeeded, ${results.filter((r) => r.status === 'error').length} failed)`,
      metadata: {
        job_id: jobId,
        job_type: jobType,
        batch_size: results.length,
        success_count: results.filter((r) => r.status === 'success').length,
        error_count: results.filter((r) => r.status === 'error').length,
      },
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          jobId,
          processedInBatch: results.length,
          totalProcessed: processedCount,
          totalFailed: failedCount,
          isComplete,
          results,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Bulk process error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processRow(supabase: any, jobType: string, row: ProcessRow, userId: string): Promise<ProcessResult> {
  const data = row.data

  switch (jobType) {
    case 'client': {
      const slug = data.slug?.trim() || data.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

      const { data: inserted, error } = await supabase
        .from('clients')
        .insert({
          name: data.name.trim(),
          slug,
          contact_name: data.contact_name?.trim() || null,
          contact_email: data.contact_email?.trim(),
          contact_phone: data.contact_phone?.trim() || null,
          website_url: data.website_url?.trim() || null,
          package_type: data.package_type?.trim().toUpperCase() || 'STARTER',
          status: 'ONBOARDING',
          notes: data.notes?.trim() || null,
        })
        .select('id')
        .single()

      if (error) throw new Error(error.message)
      return { rowIndex: row.rowIndex, status: 'success', id: inserted.id }
    }

    case 'location': {
      const { data: inserted, error } = await supabase
        .from('gbp_locations')
        .insert({
          client_id: data.client_id.trim(),
          name: data.name.trim(),
          address: data.address.trim(),
          phone: data.phone?.trim() || null,
          website_url: data.website_url?.trim() || null,
          primary_category: data.primary_category?.trim() || null,
          timezone: data.timezone?.trim() || null,
          latitude: data.latitude ? parseFloat(data.latitude) : null,
          longitude: data.longitude ? parseFloat(data.longitude) : null,
          status: 'PENDING_VERIFICATION',
        })
        .select('id')
        .single()

      if (error) throw new Error(error.message)
      return { rowIndex: row.rowIndex, status: 'success', id: inserted.id }
    }

    case 'post': {
      const { data: inserted, error } = await supabase
        .from('posts')
        .insert({
          location_id: data.location_id.trim(),
          summary: data.summary.trim(),
          content_type: data.content_type?.trim().toUpperCase() || 'STANDARD',
          title: data.title?.trim() || null,
          status: data.scheduled_at ? 'SCHEDULED' : 'DRAFT',
          scheduled_at: data.scheduled_at ? new Date(data.scheduled_at).toISOString() : null,
          call_to_action: data.call_to_action_type
            ? { type: data.call_to_action_type.trim().toUpperCase(), url: data.call_to_action_url?.trim() || null }
            : null,
          media_urls: data.media_urls ? data.media_urls.split('|').map((u: string) => u.trim()).filter(Boolean) : null,
          created_by_id: userId,
        })
        .select('id')
        .single()

      if (error) throw new Error(error.message)
      return { rowIndex: row.rowIndex, status: 'success', id: inserted.id }
    }

    case 'media': {
      const { data: inserted, error } = await supabase
        .from('gbp_media')
        .insert({
          location_id: data.location_id.trim(),
          storage_url: data.url.trim(),
          media_type: data.media_type?.trim().toUpperCase() || 'PHOTO',
          category: data.category?.trim().toUpperCase() || 'ADDITIONAL',
          file_name: data.file_name?.trim() || null,
          description: data.description?.trim() || null,
        })
        .select('id')
        .single()

      if (error) throw new Error(error.message)
      return { rowIndex: row.rowIndex, status: 'success', id: inserted.id }
    }

    case 'competitor': {
      const { data: inserted, error } = await supabase
        .from('competitors')
        .insert({
          client_id: data.client_id.trim(),
          name: data.name.trim(),
          place_id: data.place_id.trim(),
          address: data.address?.trim() || null,
          phone: data.phone?.trim() || null,
          website_url: data.website_url?.trim() || null,
          primary_category: data.primary_category?.trim() || null,
          notes: data.notes?.trim() || null,
        })
        .select('id')
        .single()

      if (error) throw new Error(error.message)
      return { rowIndex: row.rowIndex, status: 'success', id: inserted.id }
    }

    default:
      return { rowIndex: row.rowIndex, status: 'error', error: `Unknown job type: ${jobType}` }
  }
}
