import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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
    const { clientId, reportType, periodStart, periodEnd } = body

    if (!clientId || typeof clientId !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'clientId is required' } },
        { status: 400 }
      )
    }

    if (!reportType || typeof reportType !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'reportType is required' } },
        { status: 400 }
      )
    }

    const validReportTypes = ['monthly', 'quarterly', 'annual', 'custom']
    if (!validReportTypes.includes(reportType)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: `reportType must be one of: ${validReportTypes.join(', ')}` } },
        { status: 400 }
      )
    }

    if (!periodStart || isNaN(Date.parse(periodStart))) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'periodStart must be a valid date string' } },
        { status: 400 }
      )
    }

    if (!periodEnd || isNaN(Date.parse(periodEnd))) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'periodEnd must be a valid date string' } },
        { status: 400 }
      )
    }

    if (new Date(periodStart) >= new Date(periodEnd)) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'periodStart must be before periodEnd' } },
        { status: 400 }
      )
    }

    // Verify the client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, status, package_type')
      .eq('id', clientId)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Client not found' } },
        { status: 404 }
      )
    }

    // Fetch locations for this client
    const { data: locations } = await supabase
      .from('gbp_locations')
      .select('id, name, address, status')
      .eq('client_id', clientId)

    const locationIds = (locations || []).map((l: { id: string }) => l.id)

    // Fetch performance metrics for the period
    let performanceData: Record<string, unknown>[] = []
    if (locationIds.length > 0) {
      const { data: metrics } = await supabase
        .from('performance_daily')
        .select('*')
        .in('location_id', locationIds)
        .gte('period_start', periodStart)
        .lte('period_end', periodEnd)
        .order('period_start', { ascending: true })

      performanceData = metrics || []
    }

    // Aggregate performance metrics
    const aggregated = {
      totalSearchViews: 0,
      totalMapViews: 0,
      totalWebsiteClicks: 0,
      totalPhoneClicks: 0,
      totalDirectionRequests: 0,
      totalPhotoViews: 0,
    }

    for (const metric of performanceData) {
      aggregated.totalSearchViews += (metric.search_views as number) || 0
      aggregated.totalMapViews += (metric.map_views as number) || 0
      aggregated.totalWebsiteClicks += (metric.website_clicks as number) || 0
      aggregated.totalPhoneClicks += (metric.phone_clicks as number) || 0
      aggregated.totalDirectionRequests += (metric.direction_requests as number) || 0
      aggregated.totalPhotoViews += (metric.photo_views as number) || 0
    }

    // Fetch review stats for the period
    let reviewStats = {
      totalReviews: 0,
      averageRating: 0,
      ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
      respondedCount: 0,
    }

    if (locationIds.length > 0) {
      const { data: reviews } = await supabase
        .from('reviews')
        .select('star_rating, response_status')
        .in('location_id', locationIds)
        .gte('reviewed_at', periodStart)
        .lte('reviewed_at', periodEnd)

      if (reviews && reviews.length > 0) {
        reviewStats.totalReviews = reviews.length
        let ratingSum = 0
        for (const review of reviews) {
          const rating = review.star_rating as number
          ratingSum += rating
          if (rating >= 1 && rating <= 5) {
            reviewStats.ratingDistribution[rating]++
          }
          if (review.response_status === 'PUBLISHED') {
            reviewStats.respondedCount++
          }
        }
        reviewStats.averageRating = parseFloat((ratingSum / reviews.length).toFixed(2))
      }
    }

    // Fetch post stats for the period
    let postStats = {
      totalPosts: 0,
      publishedPosts: 0,
      scheduledPosts: 0,
      failedPosts: 0,
    }

    if (locationIds.length > 0) {
      const { data: posts } = await supabase
        .from('posts')
        .select('status')
        .in('location_id', locationIds)
        .gte('created_at', periodStart)
        .lte('created_at', periodEnd)

      if (posts && posts.length > 0) {
        postStats.totalPosts = posts.length
        for (const post of posts) {
          if (post.status === 'PUBLISHED') postStats.publishedPosts++
          else if (post.status === 'SCHEDULED') postStats.scheduledPosts++
          else if (post.status === 'FAILED') postStats.failedPosts++
        }
      }
    }

    // Generate AI summary
    let aiSummary = ''
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const anthropic = new Anthropic()

      const summaryPrompt = `Generate a concise performance report summary for a Google Business Profile client.

Client: ${client.name}
Period: ${periodStart} to ${periodEnd}
Report Type: ${reportType}

Performance Data:
- Search Views: ${aggregated.totalSearchViews.toLocaleString()}
- Map Views: ${aggregated.totalMapViews.toLocaleString()}
- Website Clicks: ${aggregated.totalWebsiteClicks.toLocaleString()}
- Phone Calls: ${aggregated.totalPhoneClicks.toLocaleString()}
- Direction Requests: ${aggregated.totalDirectionRequests.toLocaleString()}
- Photo Views: ${aggregated.totalPhotoViews.toLocaleString()}

Reviews:
- Total New Reviews: ${reviewStats.totalReviews}
- Average Rating: ${reviewStats.averageRating}
- Response Rate: ${reviewStats.totalReviews > 0 ? Math.round((reviewStats.respondedCount / reviewStats.totalReviews) * 100) : 0}%

Content:
- Total Posts Created: ${postStats.totalPosts}
- Published: ${postStats.publishedPosts}
- Scheduled: ${postStats.scheduledPosts}

Locations: ${locations?.length || 0}

Write a professional 3-4 paragraph executive summary highlighting key metrics, trends, and recommendations. Use specific numbers. Be concise and actionable.`

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: summaryPrompt }],
      })

      const textBlock = response.content.find((block) => block.type === 'text')
      aiSummary = textBlock ? textBlock.text : ''
    } catch (aiError) {
      console.error('AI summary generation failed:', aiError)
      aiSummary = `Performance report for ${client.name} covering ${periodStart} to ${periodEnd}. Total search views: ${aggregated.totalSearchViews.toLocaleString()}, map views: ${aggregated.totalMapViews.toLocaleString()}, website clicks: ${aggregated.totalWebsiteClicks.toLocaleString()}. ${reviewStats.totalReviews} new reviews with an average rating of ${reviewStats.averageRating}. ${postStats.publishedPosts} posts published.`
    }

    // Save report to database
    const { data: report, error: reportError } = await supabase
      .from('reports')
      .insert({
        client_id: clientId,
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'completed',
        generated_by_id: user.id,
        summary: aiSummary,
        data: {
          client: {
            id: client.id,
            name: client.name,
            packageType: client.package_type,
          },
          locations: locations || [],
          performance: aggregated,
          performanceTimeSeries: performanceData,
          reviews: reviewStats,
          posts: postStats,
        },
      })
      .select()
      .single()

    if (reportError) {
      console.error('Failed to save report:', reportError)
      return NextResponse.json(
        { success: false, error: { code: 'DB_ERROR', message: 'Failed to save report' } },
        { status: 500 }
      )
    }

    // Log activity
    await supabase.from('activity_log').insert({
      client_id: clientId,
      actor_type: 'user',
      action: 'report_generated',
      description: `${reportType} report generated for ${client.name} (${periodStart} to ${periodEnd})`,
      metadata: {
        report_id: report.id,
        report_type: reportType,
        period_start: periodStart,
        period_end: periodEnd,
      },
    })

    return NextResponse.json(
      { success: true, data: { report } },
      { status: 201 }
    )
  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
