'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { KPICard } from '@/components/shared/KPICard'
import { DateRangePicker } from '@/components/shared/DateRangePicker'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageSquare, TrendingUp, Star, Hash } from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts'

interface ReviewStats {
  totalReviews: number
  avgRating: number
  sentimentDistribution: { name: string; value: number }[]
  ratingDistribution: { rating: string; count: number }[]
  themes: { name: string; count: number }[]
  trendData: { month: string; positive: number; neutral: number; negative: number }[]
}

interface ClientOption {
  id: string
  name: string
}

const SENTIMENT_COLORS: Record<string, string> = {
  POSITIVE: '#10b981',
  NEUTRAL: '#6b7280',
  NEGATIVE: '#ef4444',
}

const PIE_COLORS = ['#10b981', '#6b7280', '#ef4444']

const RATING_COLORS: Record<string, string> = {
  '5': '#10b981',
  '4': '#22c55e',
  '3': '#eab308',
  '2': '#f97316',
  '1': '#ef4444',
}

export default function ReviewAnalyticsPage() {
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filterClient, setFilterClient] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [reviewsRes, clientsRes] = await Promise.all([
        supabase
          .from('reviews')
          .select('id, star_rating, sentiment, reviewed_at, client_id')
          .order('reviewed_at', { ascending: true })
          .limit(5000),
        supabase.from('clients').select('id, name').order('name'),
      ])

      if (clientsRes.data) {
        setClients(clientsRes.data.map((c: any) => ({ id: c.id, name: c.name })))
      }

      if (reviewsRes.data) {
        computeStats(reviewsRes.data)
      }

      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    // Re-compute when filters change
    async function reload() {
      const supabase = createClient()
      let query = supabase
        .from('reviews')
        .select('id, star_rating, sentiment, reviewed_at, client_id')
        .order('reviewed_at', { ascending: true })
        .limit(5000)

      if (filterClient !== 'all') {
        query = query.eq('client_id', filterClient)
      }
      if (dateRange.from) {
        query = query.gte('reviewed_at', dateRange.from.toISOString())
      }
      if (dateRange.to) {
        query = query.lte('reviewed_at', dateRange.to.toISOString())
      }

      const { data } = await query
      if (data) computeStats(data)
    }

    reload()
  }, [filterClient, dateRange])

  function computeStats(reviews: any[]) {
    const totalReviews = reviews.length
    const avgRating = totalReviews > 0
      ? reviews.reduce((sum, r) => sum + (r.star_rating || 0), 0) / totalReviews
      : 0

    // Sentiment distribution
    const sentMap: Record<string, number> = { POSITIVE: 0, NEUTRAL: 0, NEGATIVE: 0 }
    reviews.forEach((r) => {
      const s = r.sentiment || 'NEUTRAL'
      sentMap[s] = (sentMap[s] || 0) + 1
    })
    const sentimentDistribution = Object.entries(sentMap).map(([name, value]) => ({ name, value }))

    // Rating distribution
    const ratingMap: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    reviews.forEach((r) => {
      const rating = r.star_rating || 0
      if (rating >= 1 && rating <= 5) ratingMap[rating]++
    })
    const ratingDistribution = Object.entries(ratingMap).map(([rating, count]) => ({
      rating: `${rating} star${rating !== '1' ? 's' : ''}`,
      count,
    }))

    // Themes (simulated - in production extracted from NLP)
    const themes = [
      { name: 'Customer Service', count: Math.floor(totalReviews * 0.35) },
      { name: 'Quality', count: Math.floor(totalReviews * 0.28) },
      { name: 'Value for Money', count: Math.floor(totalReviews * 0.2) },
      { name: 'Speed', count: Math.floor(totalReviews * 0.15) },
      { name: 'Atmosphere', count: Math.floor(totalReviews * 0.12) },
      { name: 'Cleanliness', count: Math.floor(totalReviews * 0.1) },
      { name: 'Location', count: Math.floor(totalReviews * 0.08) },
      { name: 'Staff', count: Math.floor(totalReviews * 0.25) },
    ].sort((a, b) => b.count - a.count)

    // Trend data by month
    const monthMap: Record<string, { positive: number; neutral: number; negative: number }> = {}
    reviews.forEach((r) => {
      const d = new Date(r.reviewed_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!monthMap[key]) monthMap[key] = { positive: 0, neutral: 0, negative: 0 }
      const s = (r.sentiment || 'NEUTRAL').toLowerCase() as 'positive' | 'neutral' | 'negative'
      monthMap[key][s]++
    })
    const trendData = Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, data]) => ({ month, ...data }))

    setStats({
      totalReviews,
      avgRating,
      sentimentDistribution,
      ratingDistribution,
      themes,
      trendData,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Sentiment analysis and review trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Clients</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangePicker
            from={dateRange.from}
            to={dateRange.to}
            onChange={setDateRange}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard
          title="Total Reviews"
          value={stats?.totalReviews ?? 0}
          icon={MessageSquare}
          loading={loading}
        />
        <KPICard
          title="Average Rating"
          value={stats ? stats.avgRating.toFixed(1) : '0'}
          icon={Star}
          loading={loading}
        />
        <KPICard
          title="Positive %"
          value={
            stats && stats.totalReviews > 0
              ? `${Math.round(
                  ((stats.sentimentDistribution.find((s) => s.name === 'POSITIVE')?.value ?? 0) /
                    stats.totalReviews) *
                    100
                )}%`
              : '0%'
          }
          icon={TrendingUp}
          loading={loading}
        />
        <KPICard
          title="Themes Tracked"
          value={stats?.themes.length ?? 0}
          icon={Hash}
          loading={loading}
        />
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
          <Skeleton className="h-80 md:col-span-2" />
        </div>
      ) : stats ? (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Sentiment Distribution Pie */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sentiment Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.sentimentDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${(name ?? '').toLowerCase()} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {stats.sentimentDistribution.map((entry, index) => (
                      <Cell
                        key={entry.name}
                        fill={SENTIMENT_COLORS[entry.name] || PIE_COLORS[index]}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Rating Distribution Bar */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Rating Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={stats.ratingDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="rating" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RechartsTooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stats.ratingDistribution.map((entry, index) => (
                      <Cell
                        key={index}
                        fill={RATING_COLORS[String(index + 1)] || '#6b7280'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Sentiment Trend Line */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sentiment Trends</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={stats.trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <RechartsTooltip />
                  <Legend />
                  <Line type="monotone" dataKey="positive" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="neutral" stroke="#6b7280" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="negative" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Themes */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review Themes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {stats.themes.map((theme) => {
                  const maxCount = stats.themes[0]?.count || 1
                  const opacity = 0.4 + (theme.count / maxCount) * 0.6
                  return (
                    <Badge
                      key={theme.name}
                      variant="outline"
                      className="text-sm py-1.5 px-3"
                      style={{ opacity }}
                    >
                      {theme.name}
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({theme.count})
                      </span>
                    </Badge>
                  )
                })}
              </div>
              {stats.themes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No theme data available yet.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
