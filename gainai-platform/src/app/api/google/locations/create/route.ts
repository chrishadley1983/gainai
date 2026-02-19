import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createLocation } from '@/lib/google/locations'
import { getAuthenticatedClient } from '@/lib/google/auth'

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
    const { locationId, accountId, locationData } = body

    if (!locationId || typeof locationId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'locationId is required' } },
        { status: 400 }
      )
    }

    if (!accountId || typeof accountId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'accountId is required' } },
        { status: 400 }
      )
    }

    if (!locationData || typeof locationData !== 'object') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'locationData is required' } },
        { status: 400 }
      )
    }

    const authClient = await getAuthenticatedClient(locationId)
    const createdLocation = await createLocation(accountId, locationData, authClient)

    // Update the DB record with the Google location ID
    const { error: updateError } = await supabase
      .from('gbp_locations')
      .update({
        google_location_id: createdLocation.name,
        google_location_status: 'CREATED',
      })
      .eq('id', locationId)

    if (updateError) {
      console.error('Failed to update location with Google ID:', updateError)
      return NextResponse.json(
        { success: false, error: { code: 'DB_UPDATE_FAILED', message: 'Location created on Google but failed to update local record' } },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data: { location: createdLocation } },
      { status: 201 }
    )
  } catch (error) {
    console.error('Google location create error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
