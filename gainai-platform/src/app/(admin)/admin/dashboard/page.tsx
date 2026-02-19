'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Users,
  MapPin,
  FileText,
  Star,
  MessageSquare,
  PoundSterling,
  AlertTriangle,
  KeyRound,
  ThumbsDown,
  ShieldAlert,
  Clock,
  MessageCircle,
  Zap,
  PenLine,
  ClipboardCheck,
  UserPlus,
  Activity,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { KPICard } from '@/components/shared/KPICard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/formatting'
import { formatTimeAgo } from '@/lib/utils/dates'

interface DashboardData {
  totalActiveClients: number
  totalLocations: number
  postsThisMonth: number
  averageRating: number
  pendingReviews: number
  revenueThisMonth: number
}

interface Alert {
  id: string
  type: 'failed_post' | 'expired_token' | 'negative_review' | 'verification' | 'stale_client' | 'overdue_response'
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
  createdAt: string
}

interface ActivityItem {
  id: string
  actor_type: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
}

const alertIcons: Record<string, typeof AlertTriangle> = {
  failed_post: AlertTriangle,
  expired_token: KeyRound,
  negative_review: ThumbsDown,
  verification: ShieldAlert,
  stale_client: Clock,
  overdue_response: MessageCircle,
}

const alertColors: Record<string, string> = {
  high: 'text-red-600',
  medium: 'text-yellow-600',
  low: 'text-blue-600',
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchDashboardData() {
      const supabase = createClient()
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      try {
        // Fetch active clients count
        const { count: activeClients } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active')

        // Fetch total locations count
        const { count: totalLocations } = await supabase
          .from('gbp_locations')
          .select('*', { count: 'exact', head: true })

        // Fetch posts this month
        const { count: postsThisMonth } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startOfMonth)

        // Fetch average rating from locations
        const { data: ratingData } = await supabase
          .from('gbp_locations')
          .select('average_rating')
          .not('average_rating', 'is', null)

        const avgRating = ratingData && ratingData.length > 0
          ? ratingData.reduce((sum, loc) => sum + (loc.average_rating || 0), 0) / ratingData.length
          : 0

        // Fetch pending reviews
        const { count: pendingReviews } = await supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('response_status', 'pending')

        // Fetch revenue this month (sum of active client monthly_fee)
        const { data: revenueData } = await supabase
          .from('clients')
          .select('monthly_fee')
          .eq('status', 'active')

        const revenueThisMonth = revenueData
          ? revenueData.reduce((sum, c) => sum + (c.monthly_fee || 0), 0)
          : 0

        setData({
          totalActiveClients: activeClients || 0,
          totalLocations: totalLocations || 0,
          postsThisMonth: postsThisMonth || 0,
          averageRating: Math.round(avgRating * 10) / 10,
          pendingReviews: pendingReviews || 0,
          revenueThisMonth,
        })

        // Build alerts
        const alertsList: Alert[] = []

        // Failed posts
        const { data: failedPosts } = await supabase
          .from('posts')
          .select('id, title')
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(5)

        if (failedPosts) {
          failedPosts.forEach((p) => {
            alertsList.push({
              id: `fp-${p.id}`,
              type: 'failed_post',
              title: 'Failed Post',
              description: p.title || 'Untitled post failed to publish',
              severity: 'high',
              createdAt: new Date().toISOString(),
            })
          })
        }

        // TODO: Expired tokens – google_accounts table does not exist yet.
        // Re-enable once a google_accounts (or equivalent) table is created.
        // const { data: expiredTokens } = await supabase
        //   .from('google_accounts')
        //   .select('id, google_email')
        //   .lt('token_expires_at', now.toISOString())
        //   .eq('is_active', true)
        //   .limit(5)
        //
        // if (expiredTokens) {
        //   expiredTokens.forEach((t) => {
        //     alertsList.push({
        //       id: `et-${t.id}`,
        //       type: 'expired_token',
        //       title: 'Expired Token',
        //       description: `Google account ${t.google_email} token has expired`,
        //       severity: 'high',
        //       createdAt: new Date().toISOString(),
        //     })
        //   })
        // }

        // Negative reviews (1-2 stars, pending response)
        const { data: negativeReviews } = await supabase
          .from('reviews')
          .select('id, reviewer_name, star_rating')
          .lte('star_rating', 2)
          .eq('response_status', 'pending')
          .order('created_at', { ascending: false })
          .limit(5)

        if (negativeReviews) {
          negativeReviews.forEach((r) => {
            alertsList.push({
              id: `nr-${r.id}`,
              type: 'negative_review',
              title: 'Negative Review',
              description: `${r.star_rating}-star review from ${r.reviewer_name} needs response`,
              severity: 'high',
              createdAt: new Date().toISOString(),
            })
          })
        }

        // Stale clients (no activity in 30 days)
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
        const { data: staleClients } = await supabase
          .from('clients')
          .select('id, name, updated_at')
          .eq('status', 'active')
          .lt('updated_at', thirtyDaysAgo)
          .limit(5)

        if (staleClients) {
          staleClients.forEach((c) => {
            alertsList.push({
              id: `sc-${c.id}`,
              type: 'stale_client',
              title: 'Stale Client',
              description: `${c.name} has had no activity in 30+ days`,
              severity: 'low',
              createdAt: new Date().toISOString(),
            })
          })
        }

        setAlerts(alertsList)

        // Fetch recent activity
        const { data: activityData } = await supabase
          .from('activity_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20)

        setActivities(activityData || [])
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your GBP management platform
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KPICard
          title="Active Clients"
          value={data?.totalActiveClients ?? 0}
          icon={Users}
          loading={loading}
        />
        <KPICard
          title="Total Locations"
          value={data?.totalLocations ?? 0}
          icon={MapPin}
          loading={loading}
        />
        <KPICard
          title="Posts This Month"
          value={data?.postsThisMonth ?? 0}
          icon={FileText}
          loading={loading}
        />
        <KPICard
          title="Average Rating"
          value={data?.averageRating ? `${data.averageRating.toFixed(1)}` : '0.0'}
          icon={Star}
          loading={loading}
        />
        <KPICard
          title="Pending Reviews"
          value={data?.pendingReviews ?? 0}
          icon={MessageSquare}
          loading={loading}
        />
        <KPICard
          title="Revenue (Monthly)"
          value={data ? formatCurrency(data.revenueThisMonth) : formatCurrency(0)}
          icon={PoundSterling}
          loading={loading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Alerts Panel */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No alerts at this time. Everything looks good!
              </p>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert) => {
                  const AlertIcon = alertIcons[alert.type] || AlertTriangle
                  return (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <AlertIcon
                        className={`h-5 w-5 mt-0.5 shrink-0 ${alertColors[alert.severity]}`}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{alert.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {alert.description}
                        </p>
                      </div>
                      <StatusBadge status={alert.severity} />
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link href="/admin/posts">
                <PenLine className="h-4 w-4" />
                Generate Posts
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link href="/admin/reviews">
                <MessageCircle className="h-4 w-4" />
                Respond to Review
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link href="/admin/locations">
                <ClipboardCheck className="h-4 w-4" />
                Run Audit
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full justify-start gap-2">
              <Link href="/admin/clients/new">
                <UserPlus className="h-4 w-4" />
                Create Client
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : activities.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No recent activity to display.
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium capitalize">{item.actor_type}</span>
                      {' '}{item.action}{' '}
                      <span className="text-muted-foreground">{item.entity_type}</span>
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimeAgo(item.created_at)}
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
