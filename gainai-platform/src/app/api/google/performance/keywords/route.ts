import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { syncKeywordsForLocation } from '@/lib/google/performance'

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
    const { locationId } = body

    if (!locationId || typeof locationId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'locationId is required' } },
        { status: 400 }
      )
    }

    // Verify the location exists and has OAuth connected
    const { data: location, error: locationError } = await supabase
      .from('gbp_locations')
      .select('id, oauth_status')
      .eq('id', locationId)
      .single()

    if (locationError || !location) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Location not found' } },
        { status: 404 }
      )
    }

    if (location.oauth_status !== 'CONNECTED') {
      return NextResponse.json(
        { success: false, error: { code: 'OAUTH_REQUIRED', message: 'Google OAuth connection required for this location' } },
        { status: 400 }
      )
    }

    const syncedCount = await syncKeywordsForLocation(locationId)

    return NextResponse.json(
      {
        success: true,
        data: { syncedCount },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Google keywords sync error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
