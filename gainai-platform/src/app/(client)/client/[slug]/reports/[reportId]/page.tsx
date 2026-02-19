'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Download,
  Calendar,
  TrendingUp,
  Star,
  FileText,
  ArrowUpDown,
} from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { StarRating } from '@/components/shared/StarRating'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatDateRange } from '@/lib/utils/dates'
import { formatNumber } from '@/lib/utils/formatting'

interface ReportData {
  id: string
  report_type: string
  period_start: string
  period_end: string
  created_at: string
  summary: string | null
  pdf_url: string | null
  impressions_data: { date: string; impressions: number }[] | null
  actions_data: { date: string; clicks: number; calls: number; directions: number }[] | null
  device_data: { device: string; value: number }[] | null
  keywords_data: { keyword: string; impressions: number; clicks: number }[] | null
  reviews_summary: {
    new_count: number
    avg_rating: number
    positive: number
    neutral: number
    negative: number
  } | null
  posts_summary: {
    published_count: number
    top_performer_title: string | null
    top_performer_views: number | null
  } | null
  competitor_data: {
    name: string
    rating: number
    review_count: number
  }[] | null
}

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
const PIE_COLORS = ['#6366f1', '#10b981']

export default function ReportDetailPage({
  params,
}: {
  params: { slug: string; reportId: string }
}) {
  const { slug, reportId } = params
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<ReportData | null>(null)
  const [keywordSort, setKeywordSort] = useState<'impressions' | 'clicks'>('impressions')

  useEffect(() => {
    async function loadReport() {
      setLoading(true)

      const { data } = await supabase
        .from('reports')
        .select(
          'id, report_type, period_start, period_end, created_at, summary, pdf_url, impressions_data, actions_data, device_data, keywords_data, reviews_summary, posts_summary, competitor_data'
        )
        .eq('id', reportId)
        .single()

      setReport(data)
      setLoading(false)
    }

    loadReport()
  }, [reportId, supabase])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-8 w-64" />
        </div>
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/client/${slug}/reports`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Report not found</h1>
        </div>
      </div>
    )
  }

  const sortedKeywords = report.keywords_data
    ? [...report.keywords_data].sort((a, b) => b[keywordSort] - a[keywordSort])
    : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/client/${slug}/reports`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)} Report
            </h1>
            <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateRange(report.period_start, report.period_end)}
            </div>
          </div>
        </div>
        {report.pdf_url && (
          <Button
            variant="outline"
            onClick={() => window.open(report.pdf_url!, '_blank')}
          >
            <Download className="h-4 w-4 mr-1" />
            Download PDF
          </Button>
        )}
      </div>

      {/* AI summary */}
      {report.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {report.summary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Impressions trend (line chart) */}
        {report.impressions_data && report.impressions_data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Impressions Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={report.impressions_data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(val) => formatDate(val, 'dd MMM')}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      labelFormatter={(val) => formatDate(val as string, 'dd MMM yyyy')}
                      formatter={(value?: number) => [formatNumber(value ?? 0), 'Impressions']}
                    />
                    <Line
                      type="monotone"
                      dataKey="impressions"
                      stroke={CHART_COLORS[0]}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions breakdown (bar chart) */}
        {report.actions_data && report.actions_data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Actions Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.actions_data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(val) => formatDate(val, 'dd MMM')}
                    />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      labelFormatter={(val) => formatDate(val as string, 'dd MMM yyyy')}
                    />
                    <Legend />
                    <Bar dataKey="clicks" fill={CHART_COLORS[0]} name="Clicks" />
                    <Bar dataKey="calls" fill={CHART_COLORS[1]} name="Calls" />
                    <Bar dataKey="directions" fill={CHART_COLORS[2]} name="Directions" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Device split (pie) + Keywords table */}
      <div className="grid md:grid-cols-2 gap-6">
        {report.device_data && report.device_data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Device Split</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={report.device_data}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={4}
                      dataKey="value"
                      nameKey="device"
                      label={({ name, value }: { name?: string; value?: number }) => `${name ?? ''}: ${value ?? 0}%`}
                    >
                      {report.device_data.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search keywords table */}
        {sortedKeywords.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Search Keywords</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                        Keyword
                      </th>
                      <th className="text-right py-2 px-2 font-medium text-muted-foreground">
                        <button
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => setKeywordSort('impressions')}
                        >
                          Impressions
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="text-right py-2 pl-2 font-medium text-muted-foreground">
                        <button
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={() => setKeywordSort('clicks')}
                        >
                          Clicks
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedKeywords.map((kw, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-4">{kw.keyword}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">
                          {formatNumber(kw.impressions)}
                        </td>
                        <td className="py-2 pl-2 text-right text-muted-foreground">
                          {formatNumber(kw.clicks)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Review and Posts summaries */}
      <div className="grid md:grid-cols-2 gap-6">
        {report.reviews_summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                Review Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{report.reviews_summary.new_count}</p>
                  <p className="text-xs text-muted-foreground">New Reviews</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">
                    {report.reviews_summary.avg_rating.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Rating</p>
                  <StarRating
                    rating={report.reviews_summary.avg_rating}
                    size="sm"
                  />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Sentiment Breakdown</p>
                <div className="flex gap-2">
                  <div className="flex-1 rounded bg-emerald-100 p-2 text-center">
                    <p className="text-sm font-bold text-emerald-800">
                      {report.reviews_summary.positive}
                    </p>
                    <p className="text-xs text-emerald-600">Positive</p>
                  </div>
                  <div className="flex-1 rounded bg-yellow-100 p-2 text-center">
                    <p className="text-sm font-bold text-yellow-800">
                      {report.reviews_summary.neutral}
                    </p>
                    <p className="text-xs text-yellow-600">Neutral</p>
                  </div>
                  <div className="flex-1 rounded bg-red-100 p-2 text-center">
                    <p className="text-sm font-bold text-red-800">
                      {report.reviews_summary.negative}
                    </p>
                    <p className="text-xs text-red-600">Negative</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {report.posts_summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Posts Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-3xl font-bold">
                  {report.posts_summary.published_count}
                </p>
                <p className="text-sm text-muted-foreground">Posts Published</p>
              </div>
              {report.posts_summary.top_performer_title && (
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">
                    Top Performing Post
                  </p>
                  <p className="text-sm font-medium">
                    {report.posts_summary.top_performer_title}
                  </p>
                  {report.posts_summary.top_performer_views !== null && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatNumber(report.posts_summary.top_performer_views)} views
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Competitor comparison */}
      {report.competitor_data && report.competitor_data.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Competitor Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {report.competitor_data.map((competitor, i) => (
                <div
                  key={i}
                  className="rounded-lg border p-4 space-y-2"
                >
                  <p className="font-medium">{competitor.name}</p>
                  <div className="flex items-center gap-2">
                    <StarRating rating={competitor.rating} size="sm" showValue />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatNumber(competitor.review_count)} reviews
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
