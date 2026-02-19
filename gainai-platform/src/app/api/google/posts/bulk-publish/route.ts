import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { publishPost } from '@/lib/google/posts'

// Small delay between API calls to respect rate limits
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const RATE_LIMIT_DELAY_MS = 1000

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
    const { postIds } = body

    if (!Array.isArray(postIds) || postIds.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'postIds must be a non-empty array' } },
        { status: 400 }
      )
    }

    if (postIds.some((id) => typeof id !== 'string')) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'All postIds must be strings' } },
        { status: 400 }
      )
    }

    // Verify all posts exist
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select('id, status')
      .in('id', postIds)

    if (postsError) {
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Failed to fetch posts' } },
        { status: 500 }
      )
    }

    const foundIds = new Set(posts?.map((p) => p.id) ?? [])
    const missingIds = postIds.filter((id) => !foundIds.has(id))

    if (missingIds.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Posts not found: ${missingIds.join(', ')}` } },
        { status: 404 }
      )
    }

    // Publish each post sequentially with rate limiting
    const results: Array<{ postId: string; success: boolean; error?: string }> = []

    for (let i = 0; i < postIds.length; i++) {
      const postId = postIds[i]

      try {
        await publishPost(postId)
        results.push({ postId, success: true })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        results.push({ postId, success: false, error: message })
      }

      // Rate limit: wait between calls (skip delay after the last one)
      if (i < postIds.length - 1) {
        await delay(RATE_LIMIT_DELAY_MS)
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.filter((r) => !r.success).length

    return NextResponse.json(
      {
        success: true,
        data: {
          results,
          summary: {
            total: postIds.length,
            published: successCount,
            failed: failureCount,
          },
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Google bulk post publish error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
