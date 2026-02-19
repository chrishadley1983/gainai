'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Eye,
  MousePointerClick,
  Phone,
  MapPin,
  Star,
  FileText,
  Clock,
  AlertCircle,
  Check,
  X,
  Activity,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { KPICard } from '@/components/shared/KPICard'
import { StarRating } from '@/components/shared/StarRating'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatTimeAgo } from '@/lib/utils/dates'
import { truncateText } from '@/lib/utils/formatting'

interface PerformanceData {
  profile_views: number
  website_clicks: number
  phone_calls: number
  direction_requests: number
}

interface PendingPost {
  id: string
  title: string | null
  summary: string
  content_type: string
  scheduled_at: string | null
  media_urls: string[] | null
}

interface PendingReview {
  id: string
  reviewer_name: string
  star_rating: number
  comment: string | null
  reviewed_at: string
  ai_draft_response: string | null
}

interface RecentReview {
  id: string
  reviewer_name: string
  star_rating: number
  comment: string | null
  reviewed_at: string
  response_status: string
}

interface UpcomingPost {
  id: string
  title: string | null
  summary: string
  content_type: string
  status: string
  scheduled_at: string
}

interface ActivityEntry {
  id: string
  action: string
  entity_type: string
  details: string | null
  created_at: string
}

export default function ClientDashboardPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [clientId, setClientId] = useState<string | null>(null)
  const [locationId, setLocationId] = useState<string | null>(null)

  // KPIs
  const [currentMetrics, setCurrentMetrics] = useState<PerformanceData | null>(null)
  const [previousMetrics, setPreviousMetrics] = useState<PerformanceData | null>(null)

  // Second row
  const [googleRating, setGoogleRating] = useState<number>(0)
  const [reviewCount, setReviewCount] = useState<number>(0)
  const [postsPublished, setPostsPublished] = useState<number>(0)
  const [postsTarget] = useState<number>(8)
  const [avgResponseTime, setAvgResponseTime] = useState<string>('--')
  const [pendingCount, setPendingCount] = useState<number>(0)

  // Sections
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([])
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([])
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([])
  const [upcomingPosts, setUpcomingPosts] = useState<UpcomingPost[]>([])
  const [activityFeed, setActivityFeed] = useState<ActivityEntry[]>([])

  useEffect(() => {
    async function loadDashboard() {
      setLoading(true)

      // Get client by slug
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!client) {
        setLoading(false)
        return
      }

      setClientId(client.id)

      // Get primary location
      const { data: location } = await supabase
        .from('gbp_locations')
        .select('id, google_rating, review_count')
        .eq('client_id', client.id)
        .limit(1)
        .single()

      if (location) {
        setLocationId(location.id)
        setGoogleRating(location.google_rating || 0)
        setReviewCount(location.review_count || 0)
      }

      // Current month performance
      const now = new Date()
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

      const { data: currentPerf } = await supabase
        .from('performance_daily')
        .select('profile_views, website_clicks, phone_calls, direction_requests')
        .eq('client_id', client.id)
        .gte('period_start', currentMonthStart)
        .lte('period_end', currentMonthEnd)
        .single()

      if (currentPerf) {
        setCurrentMetrics(currentPerf)
      }

      // Previous month performance
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString()

      const { data: prevPerf } = await supabase
        .from('performance_daily')
        .select('profile_views, website_clicks, phone_calls, direction_requests')
        .eq('client_id', client.id)
        .gte('period_start', prevMonthStart)
        .lte('period_end', prevMonthEnd)
        .single()

      if (prevPerf) {
        setPreviousMetrics(prevPerf)
      }

      // Posts published this month
      const { count: publishedCount } = await supabase
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', client.id)
        .eq('status', 'published')
        .gte('published_at', currentMonthStart)

      setPostsPublished(publishedCount || 0)

      // Pending posts
      const { data: pendingPostsData } = await supabase
        .from('posts')
        .select('id, title, summary, content_type, scheduled_at, media_urls')
        .eq('client_id', client.id)
        .eq('status', 'pending_review')
        .order('scheduled_at', { ascending: true })
        .limit(5)

      setPendingPosts(pendingPostsData || [])

      // Pending review responses
      const { data: pendingReviewsData } = await supabase
        .from('reviews')
        .select('id, reviewer_name, star_rating, comment, reviewed_at, ai_draft_response')
        .eq('client_id', client.id)
        .eq('response_status', 'pending_approval')
        .order('reviewed_at', { ascending: false })
        .limit(5)

      setPendingReviews(pendingReviewsData || [])

      // Total pending items
      const totalPending = (pendingPostsData?.length || 0) + (pendingReviewsData?.length || 0)
      setPendingCount(totalPending)

      // Average response time (simplified)
      const { data: respondedReviews } = await supabase
        .from('reviews')
        .select('reviewed_at, responded_at')
        .eq('client_id', client.id)
        .not('responded_at', 'is', null)
        .order('responded_at', { ascending: false })
        .limit(20)

      if (respondedReviews && respondedReviews.length > 0) {
        const totalHours = respondedReviews.reduce((sum, r) => {
          const reviewed = new Date(r.reviewed_at).getTime()
          const responded = new Date(r.responded_at).getTime()
          return sum + (responded - reviewed) / (1000 * 60 * 60)
        }, 0)
        const avg = totalHours / respondedReviews.length
        if (avg < 1) {
          setAvgResponseTime(`${Math.round(avg * 60)}m`)
        } else if (avg < 24) {
          setAvgResponseTime(`${Math.round(avg)}h`)
        } else {
          setAvgResponseTime(`${Math.round(avg / 24)}d`)
        }
      }

      // Recent reviews
      const { data: recentReviewsData } = await supabase
        .from('reviews')
        .select('id, reviewer_name, star_rating, comment, reviewed_at, response_status')
        .eq('client_id', client.id)
        .order('reviewed_at', { ascending: false })
        .limit(5)

      setRecentReviews(recentReviewsData || [])

      // Upcoming posts
      const { data: upcomingPostsData } = await supabase
        .from('posts')
        .select('id, title, summary, content_type, status, scheduled_at')
        .eq('client_id', client.id)
        .in('status', ['scheduled', 'approved', 'pending_review'])
        .gte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(5)

      setUpcomingPosts(upcomingPostsData || [])

      // Activity feed
      const { data: activityData } = await supabase
        .from('activity_log')
        .select('id, action, entity_type, details, created_at')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setActivityFeed(activityData || [])

      setLoading(false)
    }

    loadDashboard()
  }, [slug, supabase])

  function calcChange(current: number | undefined, previous: number | undefined): number | undefined {
    if (current === undefined || previous === undefined || previous === 0) return undefined
    return ((current - previous) / previous) * 100
  }

  async function handleApprovePost(postId: string) {
    await supabase
      .from('posts')
      .update({ status: 'approved' })
      .eq('id', postId)

    setPendingPosts((prev) => prev.filter((p) => p.id !== postId))
    setPendingCount((prev) => prev - 1)
  }

  async function handleRejectPost(postId: string) {
    await supabase
      .from('posts')
      .update({ status: 'rejected' })
      .eq('id', postId)

    setPendingPosts((prev) => prev.filter((p) => p.id !== postId))
    setPendingCount((prev) => prev - 1)
  }

  async function handleApproveReview(reviewId: string) {
    await supabase
      .from('reviews')
      .update({ response_status: 'approved' })
      .eq('id', reviewId)

    setPendingReviews((prev) => prev.filter((r) => r.id !== reviewId))
    setPendingCount((prev) => prev - 1)
  }

  async function handleRejectReview(reviewId: string) {
    await supabase
      .from('reviews')
      .update({ response_status: 'skipped' })
      .eq('id', reviewId)

    setPendingReviews((prev) => prev.filter((r) => r.id !== reviewId))
    setPendingCount((prev) => prev - 1)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your Google Business Profile performance
        </p>
      </div>

      {/* Top row KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Profile Views"
          value={currentMetrics?.profile_views ?? '--'}
          change={calcChange(currentMetrics?.profile_views, previousMetrics?.profile_views)}
          changeLabel="vs last month"
          icon={Eye}
          loading={loading}
        />
        <KPICard
          title="Website Clicks"
          value={currentMetrics?.website_clicks ?? '--'}
          change={calcChange(currentMetrics?.website_clicks, previousMetrics?.website_clicks)}
          changeLabel="vs last month"
          icon={MousePointerClick}
          loading={loading}
        />
        <KPICard
          title="Phone Calls"
          value={currentMetrics?.phone_calls ?? '--'}
          change={calcChange(currentMetrics?.phone_calls, previousMetrics?.phone_calls)}
          changeLabel="vs last month"
          icon={Phone}
          loading={loading}
        />
        <KPICard
          title="Direction Requests"
          value={currentMetrics?.direction_requests ?? '--'}
          change={calcChange(currentMetrics?.direction_requests, previousMetrics?.direction_requests)}
          changeLabel="vs last month"
          icon={MapPin}
          loading={loading}
        />
      </div>

      {/* Second row KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="Google Rating"
          value={googleRating > 0 ? `${googleRating.toFixed(1)} (${reviewCount})` : '--'}
          icon={Star}
          loading={loading}
        />
        <KPICard
          title="Posts This Month"
          value={`${postsPublished} / ${postsTarget}`}
          icon={FileText}
          loading={loading}
        />
        <KPICard
          title="Avg Response Time"
          value={avgResponseTime}
          icon={Clock}
          loading={loading}
        />
        <KPICard
          title="Pending Items"
          value={pendingCount}
          icon={AlertCircle}
          loading={loading}
        />
      </div>

      {/* Pending approvals */}
      {(pendingPosts.length > 0 || pendingReviews.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Pending Approvals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingPosts.map((post) => (
              <div
                key={post.id}
                className="flex items-start justify-between gap-4 rounded-lg border p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={post.content_type} />
                    <span className="text-xs text-muted-foreground">Post</span>
                  </div>
                  <p className="font-medium">
                    {post.title || truncateText(post.summary, 60)}
                  </p>
                  {post.scheduled_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Scheduled: {formatDate(post.scheduled_at)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleApprovePost(post.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRejectPost(post.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {pendingReviews.map((review) => (
              <div
                key={review.id}
                className="flex items-start justify-between gap-4 rounded-lg border p-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StarRating rating={review.star_rating} size="sm" />
                    <span className="text-xs text-muted-foreground">
                      Review Response
                    </span>
                  </div>
                  <p className="text-sm font-medium">{review.reviewer_name}</p>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {truncateText(review.comment, 80)}
                    </p>
                  )}
                  {review.ai_draft_response && (
                    <p className="mt-2 text-sm italic text-muted-foreground border-l-2 border-primary/20 pl-3">
                      Draft: {truncateText(review.ai_draft_response, 100)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handleApproveReview(review.id)}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleRejectReview(review.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {(pendingPosts.length > 0 || pendingReviews.length > 0) && (
              <div className="flex gap-3 pt-2">
                {pendingPosts.length > 0 && (
                  <Link href={`/client/${slug}/posts/pending`}>
                    <Button variant="outline" size="sm">
                      View all pending posts
                    </Button>
                  </Link>
                )}
                {pendingReviews.length > 0 && (
                  <Link href={`/client/${slug}/reviews`}>
                    <Button variant="outline" size="sm">
                      View all pending reviews
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent reviews */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Reviews</CardTitle>
            <Link href={`/client/${slug}/reviews`}>
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : recentReviews.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            ) : (
              <div className="space-y-3">
                {recentReviews.map((review) => (
                  <Link
                    key={review.id}
                    href={`/client/${slug}/reviews/${review.id}`}
                    className="flex items-start gap-3 rounded-lg p-2 hover:bg-accent transition-colors"
                  >
                    <StarRating rating={review.star_rating} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{review.reviewer_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {review.comment || 'No comment'}
                      </p>
                    </div>
                    <div className="shrink-0">
                      <StatusBadge status={review.response_status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming posts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Posts</CardTitle>
            <Link href={`/client/${slug}/posts`}>
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : upcomingPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming posts.</p>
            ) : (
              <div className="space-y-3">
                {upcomingPosts.map((post) => (
                  <Link
                    key={post.id}
                    href={`/client/${slug}/posts/${post.id}`}
                    className="flex items-start gap-3 rounded-lg p-2 hover:bg-accent transition-colors"
                  >
                    <StatusBadge status={post.content_type} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">
                        {post.title || truncateText(post.summary, 50)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(post.scheduled_at)}
                      </p>
                    </div>
                    <StatusBadge status={post.status} />
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-2 w-2 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : activityFeed.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {activityFeed.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 text-sm"
                >
                  <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{entry.action}</span>
                    {entry.details && (
                      <span className="text-muted-foreground">
                        {' '}
                        &mdash; {entry.details}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatTimeAgo(entry.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
