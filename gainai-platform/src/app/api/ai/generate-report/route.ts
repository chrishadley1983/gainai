import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateMonthlyReport, generateReportSummary } from '@/lib/ai/reports'

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

    // Verify user is a team member (admin)
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
    const { clientId, month, year, reportId } = body

    // If reportId is provided, generate a summary for an existing report
    if (reportId && typeof reportId === 'string') {
      // Verify the report exists
      const { data: report, error: reportError } = await supabase
        .from('reports')
        .select('id, status')
        .eq('id', reportId)
        .single()

      if (reportError || !report) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } },
          { status: 404 }
        )
      }

      const summary = await generateReportSummary(reportId)

      return NextResponse.json(
        { success: true, data: { report: summary } },
        { status: 200 }
      )
    }

    // Otherwise, generate a new monthly report
    if (!clientId || typeof clientId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'clientId is required' } },
        { status: 400 }
      )
    }

    if (month === undefined || month === null || typeof month !== 'number' || month < 1 || month > 12) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'month must be a number between 1 and 12' } },
        { status: 400 }
      )
    }

    if (!year || typeof year !== 'number') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'year is required and must be a number' } },
        { status: 400 }
      )
    }

    // Verify the client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, status')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } },
        { status: 404 }
      )
    }

    const report = await generateMonthlyReport({
      clientId,
      month,
      year,
    })

    return NextResponse.json(
      { success: true, data: { report } },
      { status: 201 }
    )
  } catch (error) {
    console.error('AI generate report error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
