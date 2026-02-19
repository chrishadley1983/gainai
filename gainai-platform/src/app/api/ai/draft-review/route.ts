import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { draftReviewResponse } from '@/lib/ai/reviews'

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
    const { reviewId } = body

    if (!reviewId || typeof reviewId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'reviewId is required' } },
        { status: 400 }
      )
    }

    // Verify the review exists
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('id, rating, comment')
      .eq('id', reviewId)
      .single()

    if (reviewError || !review) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Review not found' } },
        { status: 404 }
      )
    }

    const draft = await draftReviewResponse(reviewId)

    return NextResponse.json(
      { success: true, data: { draft } },
      { status: 200 }
    )
  } catch (error) {
    console.error('AI draft review error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
