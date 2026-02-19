import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateContentCalendar } from '@/lib/ai/content'

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
    const { clientId, month, year, postCount, contentTypes } = body

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

    if (client.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: { code: 'CLIENT_INACTIVE', message: 'Client account is not active' } },
        { status: 400 }
      )
    }

    const posts = await generateContentCalendar({
      clientId,
      month,
      year,
      postCount: postCount || undefined,
      contentTypes: contentTypes || undefined,
    })

    return NextResponse.json(
      { success: true, data: { posts } },
      { status: 201 }
    )
  } catch (error) {
    console.error('AI generate posts error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
