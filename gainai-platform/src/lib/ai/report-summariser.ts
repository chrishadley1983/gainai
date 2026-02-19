import { createAdminClient } from '@/lib/supabase/admin'
import { generateContent } from './client'
import { reportSummaryPrompt } from './prompts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportSummaryResult {
  reportId: string
  summary: string
  model: string
}

export interface MonthlyReportData {
  totalImpressions: number
  totalWebsiteClicks: number
  totalPhoneCalls: number
  totalDirectionRequests: number
  totalBookings: number
  totalInteractions: number
  newReviews: number
  averageRating: number | null
  postsPublished: number
  previousPeriod?: {
    totalImpressions: number
    totalWebsiteClicks: number
    totalPhoneCalls: number
    totalDirectionRequests: number
    totalBookings: number
    totalInteractions: number
    newReviews: number
    averageRating: number | null
    postsPublished: number
  }
}

export interface MonthlyReportResult {
  reportId: string
  clientId: string
  summary: string
  data: MonthlyReportData
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPeriod(month: number, year: number): string {
  const date = new Date(year, month - 1)
  return date.toLocaleString('en-GB', { month: 'long', year: 'numeric' })
}

function calculatePercentChange(current: number, previous: number): string {
  if (previous === 0) {
    return current > 0 ? '+100%' : '0%'
  }
  const change = ((current - previous) / previous) * 100
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(1)}%`
}

function buildPerformanceDataString(
  data: MonthlyReportData,
  period: string
): string {
  const lines: string[] = [
    `Period: ${period}`,
    '',
    'Current Period:',
    `  Total Impressions: ${data.totalImpressions.toLocaleString('en-GB')}`,
    `  Website Clicks: ${data.totalWebsiteClicks.toLocaleString('en-GB')}`,
    `  Phone Calls: ${data.totalPhoneCalls.toLocaleString('en-GB')}`,
    `  Direction Requests: ${data.totalDirectionRequests.toLocaleString('en-GB')}`,
    `  Bookings: ${data.totalBookings.toLocaleString('en-GB')}`,
    `  Total Interactions: ${data.totalInteractions.toLocaleString('en-GB')}`,
    `  New Reviews: ${data.newReviews}`,
    `  Average Rating: ${data.averageRating !== null ? data.averageRating.toFixed(1) : 'N/A'}`,
    `  Posts Published: ${data.postsPublished}`,
  ]

  if (data.previousPeriod) {
    const prev = data.previousPeriod
    lines.push(
      '',
      'Previous Period:',
      `  Total Impressions: ${prev.totalImpressions.toLocaleString('en-GB')}`,
      `  Website Clicks: ${prev.totalWebsiteClicks.toLocaleString('en-GB')}`,
      `  Phone Calls: ${prev.totalPhoneCalls.toLocaleString('en-GB')}`,
      `  Direction Requests: ${prev.totalDirectionRequests.toLocaleString('en-GB')}`,
      `  Bookings: ${prev.totalBookings.toLocaleString('en-GB')}`,
      `  Total Interactions: ${prev.totalInteractions.toLocaleString('en-GB')}`,
      `  New Reviews: ${prev.newReviews}`,
      `  Average Rating: ${prev.averageRating !== null ? prev.averageRating.toFixed(1) : 'N/A'}`,
      `  Posts Published: ${prev.postsPublished}`,
      '',
      'Changes:',
      `  Impressions: ${calculatePercentChange(data.totalImpressions, prev.totalImpressions)}`,
      `  Website Clicks: ${calculatePercentChange(data.totalWebsiteClicks, prev.totalWebsiteClicks)}`,
      `  Phone Calls: ${calculatePercentChange(data.totalPhoneCalls, prev.totalPhoneCalls)}`,
      `  Direction Requests: ${calculatePercentChange(data.totalDirectionRequests, prev.totalDirectionRequests)}`,
      `  Interactions: ${calculatePercentChange(data.totalInteractions, prev.totalInteractions)}`,
    )
  }

  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Generate report summary
// ---------------------------------------------------------------------------

/**
 * Generate an AI summary for an existing report record.
 *
 * Fetches the report data from the database, generates a plain-English
 * summary via Claude, and saves it to the report's `summary` field.
 */
export async function generateReportSummary(
  reportId: string
): Promise<ReportSummaryResult> {
  const supabase = createAdminClient()

  // --- Fetch report with client data ---
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select(`
      id,
      client_id,
      location_id,
      report_type,
      period_start,
      period_end,
      data,
      clients!inner (
        id,
        name
      )
    `)
    .eq('id', reportId)
    .single()

  if (reportError || !report) {
    throw new Error(
      `Report not found: ${reportError?.message || 'Unknown error'}`
    )
  }

  const clientData = report.clients as unknown as {
    id: string
    name: string
  }

  const periodStart = new Date(report.period_start)
  const periodEnd = new Date(report.period_end)
  const period = `${periodStart.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} - ${periodEnd.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`

  // Format the report data as a readable string for the AI
  const performanceData =
    typeof report.data === 'string'
      ? report.data
      : JSON.stringify(report.data, null, 2)

  // --- Generate with Claude ---
  const { systemPrompt, userPrompt } = reportSummaryPrompt({
    businessName: clientData.name,
    period,
    performanceData,
  })

  const aiResult = await generateContent(systemPrompt, userPrompt, {
    maxTokens: 2048,
    temperature: 0.5,
  })

  // --- Save summary to report ---
  const { error: updateError } = await supabase
    .from('reports')
    .update({ summary: aiResult.content })
    .eq('id', reportId)

  if (updateError) {
    throw new Error(
      `Failed to save report summary: ${updateError.message}`
    )
  }

  return {
    reportId,
    summary: aiResult.content,
    model: aiResult.model,
  }
}

// ---------------------------------------------------------------------------
// Generate full monthly report
// ---------------------------------------------------------------------------

/**
 * Compile performance data for a client's month, generate an AI summary,
 * and save the full report to the `reports` table.
 *
 * Aggregates data from performance_daily, reviews, and posts tables,
 * compares to the previous month, and generates a readable summary.
 */
export async function generateMonthlyReport(
  clientId: string,
  month: number,
  year: number
): Promise<MonthlyReportResult> {
  const supabase = createAdminClient()

  // --- Fetch client ---
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', clientId)
    .single()

  if (clientError || !client) {
    throw new Error(
      `Client not found: ${clientError?.message || 'Unknown error'}`
    )
  }

  // --- Fetch locations for this client ---
  const { data: locations } = await supabase
    .from('gbp_locations')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'verified')

  const locationIds = locations?.map((l) => l.id) || []

  if (locationIds.length === 0) {
    throw new Error(
      `No verified locations found for client ${client.name}`
    )
  }

  // --- Calculate date ranges ---
  const periodStart = new Date(year, month - 1, 1)
  const periodEnd = new Date(year, month, 0) // Last day of month

  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevPeriodStart = new Date(prevYear, prevMonth - 1, 1)
  const prevPeriodEnd = new Date(prevYear, prevMonth, 0)

  const periodStartStr = periodStart.toISOString().split('T')[0]
  const periodEndStr = periodEnd.toISOString().split('T')[0]
  const prevPeriodStartStr = prevPeriodStart.toISOString().split('T')[0]
  const prevPeriodEndStr = prevPeriodEnd.toISOString().split('T')[0]

  // --- Fetch current period performance data ---
  const currentMetrics = await fetchPeriodMetrics(
    supabase,
    locationIds,
    periodStartStr,
    periodEndStr
  )

  // --- Fetch previous period performance data ---
  const prevMetrics = await fetchPeriodMetrics(
    supabase,
    locationIds,
    prevPeriodStartStr,
    prevPeriodEndStr
  )

  // --- Fetch current period reviews ---
  const { data: currentReviews } = await supabase
    .from('reviews')
    .select('id, star_rating')
    .eq('client_id', clientId)
    .gte('reviewed_at', periodStart.toISOString())
    .lte('reviewed_at', periodEnd.toISOString())

  const { data: prevReviews } = await supabase
    .from('reviews')
    .select('id, star_rating')
    .eq('client_id', clientId)
    .gte('reviewed_at', prevPeriodStart.toISOString())
    .lte('reviewed_at', prevPeriodEnd.toISOString())

  // --- Fetch current period posts ---
  const { data: currentPosts } = await supabase
    .from('posts')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .gte('published_at', periodStart.toISOString())
    .lte('published_at', periodEnd.toISOString())

  const { data: prevPosts } = await supabase
    .from('posts')
    .select('id')
    .eq('client_id', clientId)
    .eq('status', 'published')
    .gte('published_at', prevPeriodStart.toISOString())
    .lte('published_at', prevPeriodEnd.toISOString())

  // --- Compute average ratings ---
  const currentAvgRating = computeAverageRating(currentReviews)
  const prevAvgRating = computeAverageRating(prevReviews)

  // --- Compile report data ---
  const reportData: MonthlyReportData = {
    totalImpressions:
      currentMetrics.desktopImpressions + currentMetrics.mobileImpressions,
    totalWebsiteClicks: currentMetrics.websiteClicks,
    totalPhoneCalls: currentMetrics.phoneCalls,
    totalDirectionRequests: currentMetrics.directionRequests,
    totalBookings: currentMetrics.bookings,
    totalInteractions: currentMetrics.totalInteractions,
    newReviews: currentReviews?.length || 0,
    averageRating: currentAvgRating,
    postsPublished: currentPosts?.length || 0,
    previousPeriod: {
      totalImpressions:
        prevMetrics.desktopImpressions + prevMetrics.mobileImpressions,
      totalWebsiteClicks: prevMetrics.websiteClicks,
      totalPhoneCalls: prevMetrics.phoneCalls,
      totalDirectionRequests: prevMetrics.directionRequests,
      totalBookings: prevMetrics.bookings,
      totalInteractions: prevMetrics.totalInteractions,
      newReviews: prevReviews?.length || 0,
      averageRating: prevAvgRating,
      postsPublished: prevPosts?.length || 0,
    },
  }

  // --- Generate AI summary ---
  const period = formatPeriod(month, year)
  const performanceDataStr = buildPerformanceDataString(reportData, period)

  const { systemPrompt, userPrompt } = reportSummaryPrompt({
    businessName: client.name,
    period,
    performanceData: performanceDataStr,
  })

  const aiResult = await generateContent(systemPrompt, userPrompt, {
    maxTokens: 2048,
    temperature: 0.5,
  })

  // --- Save report to database ---
  const { data: savedReport, error: insertError } = await supabase
    .from('reports')
    .insert({
      client_id: clientId,
      location_id: locationIds[0], // Primary location
      report_type: 'monthly',
      period_start: periodStartStr,
      period_end: periodEndStr,
      data: reportData as unknown as Record<string, unknown>,
      summary: aiResult.content,
    })
    .select('id')
    .single()

  if (insertError || !savedReport) {
    throw new Error(
      `Failed to save monthly report: ${insertError?.message || 'Unknown error'}`
    )
  }

  // --- Log activity ---
  await supabase.from('activity_log').insert({
    client_id: clientId,
    location_id: locationIds[0],
    actor_type: 'ai',
    action: 'monthly_report_generated',
    description: `Monthly report generated for ${period}`,
    metadata: {
      report_id: savedReport.id,
      month,
      year,
      model: aiResult.model,
    },
  })

  return {
    reportId: savedReport.id,
    clientId,
    summary: aiResult.content,
    data: reportData,
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface AggregatedMetrics {
  desktopImpressions: number
  mobileImpressions: number
  searchImpressions: number
  mapsImpressions: number
  websiteClicks: number
  phoneCalls: number
  directionRequests: number
  bookings: number
  totalInteractions: number
}

async function fetchPeriodMetrics(
  supabase: ReturnType<typeof createAdminClient>,
  locationIds: string[],
  startDate: string,
  endDate: string
): Promise<AggregatedMetrics> {
  const { data } = await supabase
    .from('performance_daily')
    .select(
      'business_impressions_desktop, business_impressions_mobile, search_impressions, maps_impressions, website_clicks, phone_calls, direction_requests, bookings, total_interactions'
    )
    .in('location_id', locationIds)
    .gte('date', startDate)
    .lte('date', endDate)

  if (!data || data.length === 0) {
    return {
      desktopImpressions: 0,
      mobileImpressions: 0,
      searchImpressions: 0,
      mapsImpressions: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
      bookings: 0,
      totalInteractions: 0,
    }
  }

  return data.reduce<AggregatedMetrics>(
    (acc, row) => ({
      desktopImpressions:
        acc.desktopImpressions + (row.business_impressions_desktop || 0),
      mobileImpressions:
        acc.mobileImpressions + (row.business_impressions_mobile || 0),
      searchImpressions:
        acc.searchImpressions + (row.search_impressions || 0),
      mapsImpressions:
        acc.mapsImpressions + (row.maps_impressions || 0),
      websiteClicks: acc.websiteClicks + (row.website_clicks || 0),
      phoneCalls: acc.phoneCalls + (row.phone_calls || 0),
      directionRequests:
        acc.directionRequests + (row.direction_requests || 0),
      bookings: acc.bookings + (row.bookings || 0),
      totalInteractions:
        acc.totalInteractions + (row.total_interactions || 0),
    }),
    {
      desktopImpressions: 0,
      mobileImpressions: 0,
      searchImpressions: 0,
      mapsImpressions: 0,
      websiteClicks: 0,
      phoneCalls: 0,
      directionRequests: 0,
      bookings: 0,
      totalInteractions: 0,
    }
  )
}

function computeAverageRating(
  reviews: { star_rating: number }[] | null
): number | null {
  if (!reviews || reviews.length === 0) return null
  const sum = reviews.reduce((acc, r) => acc + r.star_rating, 0)
  return Number((sum / reviews.length).toFixed(1))
}
