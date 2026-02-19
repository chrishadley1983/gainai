import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

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

    if (!jobId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'jobId is required' } },
        { status: 400 }
      )
    }

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

    // Calculate progress percentage
    const progress = job.total_items > 0
      ? Math.round((job.processed_items / job.total_items) * 100)
      : 0

    return NextResponse.json(
      {
        success: true,
        data: {
          id: job.id,
          type: job.type,
          status: job.status,
          totalItems: job.total_items,
          processedItems: job.processed_items,
          failedItems: job.failed_items,
          progress,
          errors: job.errors || [],
          metadata: job.metadata || {},
          startedAt: job.started_at,
          completedAt: job.completed_at,
          createdAt: job.created_at,
          updatedAt: job.updated_at,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Bulk status error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
