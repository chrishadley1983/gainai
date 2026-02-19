import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  getVerificationOptions,
  requestVerification,
  completeVerification,
} from '@/lib/google/verification'

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
    const { locationId, action, method, pin } = body

    if (!locationId || typeof locationId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'locationId is required' } },
        { status: 400 }
      )
    }

    if (!action || !['options', 'request', 'complete'].includes(action)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'action must be one of: options, request, complete' } },
        { status: 400 }
      )
    }

    switch (action) {
      case 'options': {
        const options = await getVerificationOptions(locationId)
        return NextResponse.json(
          { success: true, data: { options } },
          { status: 200 }
        )
      }

      case 'request': {
        if (!method || typeof method !== 'string') {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_INPUT', message: 'method is required for request action' } },
            { status: 400 }
          )
        }

        const result = await requestVerification(locationId, method)

        // Update location verification status
        await supabase
          .from('gbp_locations')
          .update({ verification_status: 'PENDING' })
          .eq('id', locationId)

        return NextResponse.json(
          { success: true, data: { result } },
          { status: 200 }
        )
      }

      case 'complete': {
        if (!pin || typeof pin !== 'string') {
          return NextResponse.json(
            { success: false, error: { code: 'INVALID_INPUT', message: 'pin is required for complete action' } },
            { status: 400 }
          )
        }

        const result = await completeVerification(locationId, pin)

        // Update location verification status
        await supabase
          .from('gbp_locations')
          .update({ verification_status: 'VERIFIED' })
          .eq('id', locationId)

        return NextResponse.json(
          { success: true, data: { result } },
          { status: 200 }
        )
      }
    }
  } catch (error) {
    console.error('Google location verification error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
