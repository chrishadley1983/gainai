import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> }
) {
  try {
    const { reportId } = await params

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

    if (!reportId) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'reportId is required' } },
        { status: 400 }
      )
    }

    const { data: report, error: reportError } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (reportError || !report) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Report not found' } },
        { status: 404 }
      )
    }

    const data = (report.data || {}) as Record<string, unknown>
    const clientInfo = (data.client || {}) as Record<string, unknown>
    const performance = (data.performance || {}) as Record<string, number>
    const reviews = (data.reviews || {}) as Record<string, unknown>
    const posts = (data.posts || {}) as Record<string, number>
    const locations = (data.locations || []) as Array<Record<string, unknown>>
    const ratingDistribution = (reviews.ratingDistribution || {}) as Record<number, number>

    const periodStart = new Date(report.period_start).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const periodEnd = new Date(report.period_end).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    const generatedAt = new Date(report.created_at).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    const summaryHtml = (report.summary || '').replace(/\n/g, '<br>')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Report - ${escapeHtml(String(clientInfo.name || 'Client'))}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a2e;
      background: #ffffff;
      line-height: 1.6;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    @media print {
      body { padding: 20px; }
      .page-break { page-break-before: always; }
    }
    .header {
      border-bottom: 3px solid #6366f1;
      padding-bottom: 24px;
      margin-bottom: 32px;
    }
    .header h1 {
      font-size: 28px;
      color: #6366f1;
      margin-bottom: 4px;
    }
    .header .subtitle {
      font-size: 16px;
      color: #64748b;
    }
    .header .meta {
      margin-top: 12px;
      font-size: 13px;
      color: #94a3b8;
    }
    .section {
      margin-bottom: 32px;
    }
    .section h2 {
      font-size: 20px;
      color: #1e293b;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .summary {
      background: #f8fafc;
      border-left: 4px solid #6366f1;
      padding: 20px 24px;
      border-radius: 0 8px 8px 0;
      font-size: 14px;
      color: #334155;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .metric-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .metric-card .value {
      font-size: 28px;
      font-weight: 700;
      color: #6366f1;
    }
    .metric-card .label {
      font-size: 12px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 4px;
    }
    .review-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 24px;
    }
    .rating-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .rating-bar .star-label {
      width: 50px;
      font-size: 13px;
      color: #64748b;
      text-align: right;
    }
    .rating-bar .bar-bg {
      flex: 1;
      height: 16px;
      background: #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }
    .rating-bar .bar-fill {
      height: 100%;
      background: #6366f1;
      border-radius: 8px;
      transition: width 0.3s;
    }
    .rating-bar .count {
      width: 30px;
      font-size: 13px;
      color: #64748b;
    }
    .review-overview .big-number {
      font-size: 48px;
      font-weight: 700;
      color: #6366f1;
      text-align: center;
    }
    .review-overview .big-label {
      font-size: 14px;
      color: #64748b;
      text-align: center;
      margin-bottom: 16px;
    }
    .post-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
    }
    .post-stat {
      text-align: center;
      padding: 12px;
      background: #f8fafc;
      border-radius: 8px;
    }
    .post-stat .val { font-size: 24px; font-weight: 700; color: #1e293b; }
    .post-stat .lbl { font-size: 11px; color: #64748b; text-transform: uppercase; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    table th, table td {
      padding: 10px 12px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    table th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .status-active { background: #dcfce7; color: #166534; }
    .status-other { background: #f1f5f9; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <h1>GainAI Performance Report</h1>
    <div class="subtitle">${escapeHtml(String(clientInfo.name || 'Client'))} &mdash; ${escapeHtml(capitalize(report.report_type))} Report</div>
    <div class="meta">
      Period: ${periodStart} &ndash; ${periodEnd} &bull;
      Generated: ${generatedAt} &bull;
      Package: ${escapeHtml(String(clientInfo.packageType || 'N/A'))}
    </div>
  </div>

  <div class="section">
    <h2>Executive Summary</h2>
    <div class="summary">${summaryHtml}</div>
  </div>

  <div class="section">
    <h2>Visibility &amp; Engagement</h2>
    <div class="metrics-grid">
      <div class="metric-card">
        <div class="value">${formatNumber(performance.totalSearchViews || 0)}</div>
        <div class="label">Search Views</div>
      </div>
      <div class="metric-card">
        <div class="value">${formatNumber(performance.totalMapViews || 0)}</div>
        <div class="label">Map Views</div>
      </div>
      <div class="metric-card">
        <div class="value">${formatNumber(performance.totalWebsiteClicks || 0)}</div>
        <div class="label">Website Clicks</div>
      </div>
      <div class="metric-card">
        <div class="value">${formatNumber(performance.totalPhoneClicks || 0)}</div>
        <div class="label">Phone Calls</div>
      </div>
      <div class="metric-card">
        <div class="value">${formatNumber(performance.totalDirectionRequests || 0)}</div>
        <div class="label">Direction Requests</div>
      </div>
      <div class="metric-card">
        <div class="value">${formatNumber(performance.totalPhotoViews || 0)}</div>
        <div class="label">Photo Views</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h2>Reviews</h2>
    <div class="review-stats">
      <div class="review-overview">
        <div class="big-number">${reviews.averageRating || 'N/A'}</div>
        <div class="big-label">Average Rating</div>
        <div style="text-align:center;font-size:14px;color:#475569;">
          ${reviews.totalReviews || 0} new reviews &bull;
          ${reviews.respondedCount || 0} responded
          (${(reviews.totalReviews as number) > 0 ? Math.round(((reviews.respondedCount as number) / (reviews.totalReviews as number)) * 100) : 0}% response rate)
        </div>
      </div>
      <div>
        <div style="font-weight:600;margin-bottom:12px;color:#475569;font-size:13px;">RATING DISTRIBUTION</div>
        ${[5, 4, 3, 2, 1].map((star) => {
          const count = ratingDistribution[star] || 0
          const total = (reviews.totalReviews as number) || 1
          const pct = Math.round((count / total) * 100)
          return `<div class="rating-bar">
            <span class="star-label">${star} star${star > 1 ? 's' : ''}</span>
            <div class="bar-bg"><div class="bar-fill" style="width:${pct}%"></div></div>
            <span class="count">${count}</span>
          </div>`
        }).join('')}
      </div>
    </div>
  </div>

  <div class="section page-break">
    <h2>Content &amp; Posts</h2>
    <div class="post-stats">
      <div class="post-stat">
        <div class="val">${posts.totalPosts || 0}</div>
        <div class="lbl">Total</div>
      </div>
      <div class="post-stat">
        <div class="val">${posts.publishedPosts || 0}</div>
        <div class="lbl">Published</div>
      </div>
      <div class="post-stat">
        <div class="val">${posts.scheduledPosts || 0}</div>
        <div class="lbl">Scheduled</div>
      </div>
      <div class="post-stat">
        <div class="val">${posts.failedPosts || 0}</div>
        <div class="lbl">Failed</div>
      </div>
    </div>
  </div>

  ${locations.length > 0 ? `
  <div class="section">
    <h2>Locations (${locations.length})</h2>
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Address</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${locations.map((loc) => `<tr>
          <td>${escapeHtml(String(loc.name || ''))}</td>
          <td>${escapeHtml(String(loc.address || ''))}</td>
          <td><span class="status-badge ${loc.status === 'ACTIVE' ? 'status-active' : 'status-other'}">${escapeHtml(String(loc.status || 'N/A'))}</span></td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
  ` : ''}

  <div class="footer">
    <p>This report was generated by GainAI. Data sourced from Google Business Profile.</p>
    <p>Report ID: ${escapeHtml(report.id)} &bull; Use Ctrl+P / Cmd+P to save as PDF</p>
  </div>
</body>
</html>`

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="report-${report.id}.html"`,
      },
    })
  } catch (error) {
    console.error('Report PDF generation error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return num.toLocaleString()
}
