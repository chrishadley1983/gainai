import { createAdminClient } from '@/lib/supabase/admin'
import { runAuditChecks } from '@/lib/audit/runner'
import { calculateAuditScore } from '@/lib/audit/scoring'
import type { AuditScore } from '@/lib/audit/scoring'
import type { AuditCheck } from '@/lib/audit/runner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportData {
  client: ReportClient
  period: {
    start: string
    end: string
  }
  locations: ReportLocation[]
  reviewsSummary: ReviewsSummary
  postsSummary: PostsSummary
  performanceSummary: PerformanceSummary
  generatedAt: string
}

export interface ReportClient {
  id: string
  name: string
  slug: string
  package: string | null
  status: string
}

export interface ReportLocation {
  id: string
  name: string
  address: string | null
  auditScore: AuditScore
  auditChecks: AuditCheck[]
}

export interface ReviewsSummary {
  totalReviews: number
  newReviews: number
  averageRating: number
  responseRate: number
  ratingDistribution: Record<number, number>
}

export interface PostsSummary {
  totalPublished: number
  totalScheduled: number
  totalDraft: number
  byContentType: Record<string, number>
}

export interface PerformanceSummary {
  totalSearchImpressions: number
  totalMapImpressions: number
  totalWebsiteClicks: number
  totalPhoneClicks: number
  totalDirectionRequests: number
  dailyMetrics: DailyMetricPoint[]
}

export interface DailyMetricPoint {
  date: string
  search_impressions: number
  map_impressions: number
  website_clicks: number
  phone_clicks: number
  direction_requests: number
}

// ---------------------------------------------------------------------------
// compileReportData – gather all data for a client report
// ---------------------------------------------------------------------------

/**
 * Compile all data needed for a client performance report.
 *
 * Aggregates location audits, review stats, post counts, and performance
 * metrics for the given period.
 *
 * @param clientId - The internal client ID.
 * @param periodStart - Start of the reporting period (ISO date string or Date).
 * @param periodEnd - End of the reporting period (ISO date string or Date).
 */
export async function compileReportData(
  clientId: string,
  periodStart: Date | string,
  periodEnd: Date | string
): Promise<ReportData> {
  const supabase = createAdminClient()

  const startStr =
    typeof periodStart === 'string'
      ? periodStart
      : periodStart.toISOString().split('T')[0]
  const endStr =
    typeof periodEnd === 'string'
      ? periodEnd
      : periodEnd.toISOString().split('T')[0]

  // -------------------------------------------------------------------------
  // Fetch client
  // -------------------------------------------------------------------------

  const { data: clientData, error: clientError } = await supabase
    .from('clients')
    .select('id, name, slug, package, status')
    .eq('id', clientId)
    .single()

  if (clientError || !clientData) {
    throw new Error(
      `Client ${clientId} not found: ${clientError?.message ?? 'no data'}`
    )
  }

  // -------------------------------------------------------------------------
  // Fetch locations
  // -------------------------------------------------------------------------

  const { data: locationsData, error: locationsError } = await supabase
    .from('gbp_locations')
    .select('id, name, address')
    .eq('client_id', clientId)
    .eq('status', 'ACTIVE')

  if (locationsError) {
    throw new Error(`Failed to fetch locations: ${locationsError.message}`)
  }

  const locations = locationsData ?? []

  // -------------------------------------------------------------------------
  // Run audits for each location
  // -------------------------------------------------------------------------

  const reportLocations: ReportLocation[] = []

  for (const loc of locations) {
    try {
      const auditResult = await runAuditChecks(loc.id)
      const auditScore = calculateAuditScore(auditResult.checks)

      reportLocations.push({
        id: loc.id,
        name: loc.name,
        address: loc.address,
        auditScore,
        auditChecks: auditResult.checks,
      })
    } catch (err) {
      console.error(
        `[reports/generator] Audit failed for location ${loc.id}:`,
        err instanceof Error ? err.message : err
      )
      // Still include the location with empty audit
      reportLocations.push({
        id: loc.id,
        name: loc.name,
        address: loc.address,
        auditScore: {
          overallScore: 0,
          overallMaxScore: 0,
          overallPercentage: 0,
          letterGrade: 'F',
          categories: [],
        },
        auditChecks: [],
      })
    }
  }

  // -------------------------------------------------------------------------
  // Reviews summary
  // -------------------------------------------------------------------------

  const { data: allReviews } = await supabase
    .from('reviews')
    .select('star_rating, response_status, reviewed_at')
    .eq('client_id', clientId)

  const reviews = allReviews ?? []
  const newReviews = reviews.filter(
    (r) => r.reviewed_at >= startStr && r.reviewed_at <= endStr + 'T23:59:59Z'
  )

  const totalReviews = reviews.length
  const avgRating =
    totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.star_rating, 0) / totalReviews
      : 0

  const respondedCount = reviews.filter(
    (r) => r.response_status === 'PUBLISHED' || r.response_status === 'APPROVED'
  ).length
  const responseRate = totalReviews > 0 ? (respondedCount / totalReviews) * 100 : 0

  const ratingDistribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of reviews) {
    if (r.star_rating >= 1 && r.star_rating <= 5) {
      ratingDistribution[r.star_rating]++
    }
  }

  const reviewsSummary: ReviewsSummary = {
    totalReviews,
    newReviews: newReviews.length,
    averageRating: parseFloat(avgRating.toFixed(2)),
    responseRate: parseFloat(responseRate.toFixed(1)),
    ratingDistribution,
  }

  // -------------------------------------------------------------------------
  // Posts summary
  // -------------------------------------------------------------------------

  const { data: postsData } = await supabase
    .from('posts')
    .select('status, content_type')
    .eq('client_id', clientId)

  const allPosts = postsData ?? []

  const byContentType: Record<string, number> = {}
  for (const p of allPosts) {
    byContentType[p.content_type] = (byContentType[p.content_type] ?? 0) + 1
  }

  const postsSummary: PostsSummary = {
    totalPublished: allPosts.filter((p) => p.status === 'PUBLISHED').length,
    totalScheduled: allPosts.filter((p) => p.status === 'SCHEDULED').length,
    totalDraft: allPosts.filter((p) => p.status === 'DRAFT').length,
    byContentType,
  }

  // -------------------------------------------------------------------------
  // Performance summary
  // -------------------------------------------------------------------------

  const locationIds = locations.map((l) => l.id)

  let performanceSummary: PerformanceSummary = {
    totalSearchImpressions: 0,
    totalMapImpressions: 0,
    totalWebsiteClicks: 0,
    totalPhoneClicks: 0,
    totalDirectionRequests: 0,
    dailyMetrics: [],
  }

  if (locationIds.length > 0) {
    const { data: perfData } = await supabase
      .from('performance_daily')
      .select('*')
      .in('location_id', locationIds)
      .gte('date', startStr)
      .lte('date', endStr)
      .order('date', { ascending: true })

    const perfRows = perfData ?? []

    // Aggregate daily metrics across locations
    const dailyMap = new Map<string, DailyMetricPoint>()

    for (const row of perfRows) {
      const existing = dailyMap.get(row.date) ?? {
        date: row.date,
        search_impressions: 0,
        map_impressions: 0,
        website_clicks: 0,
        phone_clicks: 0,
        direction_requests: 0,
      }

      existing.search_impressions += row.search_impressions ?? 0
      existing.map_impressions += row.map_impressions ?? 0
      existing.website_clicks += row.website_clicks ?? 0
      existing.phone_clicks += row.phone_clicks ?? 0
      existing.direction_requests += row.direction_requests ?? 0

      dailyMap.set(row.date, existing)
    }

    const dailyMetrics = Array.from(dailyMap.values()).sort(
      (a, b) => a.date.localeCompare(b.date)
    )

    performanceSummary = {
      totalSearchImpressions: dailyMetrics.reduce(
        (sum, d) => sum + d.search_impressions,
        0
      ),
      totalMapImpressions: dailyMetrics.reduce(
        (sum, d) => sum + d.map_impressions,
        0
      ),
      totalWebsiteClicks: dailyMetrics.reduce(
        (sum, d) => sum + d.website_clicks,
        0
      ),
      totalPhoneClicks: dailyMetrics.reduce(
        (sum, d) => sum + d.phone_clicks,
        0
      ),
      totalDirectionRequests: dailyMetrics.reduce(
        (sum, d) => sum + d.direction_requests,
        0
      ),
      dailyMetrics,
    }
  }

  // -------------------------------------------------------------------------
  // Assemble report
  // -------------------------------------------------------------------------

  return {
    client: {
      id: clientData.id,
      name: clientData.name,
      slug: clientData.slug,
      package: clientData.package,
      status: clientData.status,
    },
    period: {
      start: startStr,
      end: endStr,
    },
    locations: reportLocations,
    reviewsSummary,
    postsSummary,
    performanceSummary,
    generatedAt: new Date().toISOString(),
  }
}
