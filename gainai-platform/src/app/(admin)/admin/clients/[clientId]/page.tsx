'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Pencil,
  MapPin,
  FileText,
  MessageSquare,
  Image,
  BarChart3,
  Target,
  ClipboardCheck,
  Activity,
  Globe,
  Mail,
  Phone,
  Building2,
  Star,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { KPICard } from '@/components/shared/KPICard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils/formatting'
import { formatTimeAgo, formatDate } from '@/lib/utils/dates'

interface ClientDetail {
  id: string
  name: string
  slug: string
  status: string
  package: string
  monthly_fee: number
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  industry: string | null
  website: string | null
  address: { line1?: string; city?: string; county?: string; postcode?: string } | null
  brand_voice: Record<string, unknown> | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

interface QuickStats {
  locationsCount: number
  postsThisMonth: number
  averageRating: number
  pendingReviews: number
}

interface ActivityItem {
  id: string
  actor_type: string
  action: string
  entity_type: string
  created_at: string
}

const clientTabs = [
  { value: 'overview', label: 'Overview', icon: Building2 },
  { value: 'locations', label: 'Locations', icon: MapPin, href: 'locations' },
  { value: 'posts', label: 'Posts', icon: FileText, href: 'posts' },
  { value: 'reviews', label: 'Reviews', icon: MessageSquare, href: 'reviews' },
  { value: 'media', label: 'Media', icon: Image, href: 'media' },
  { value: 'reports', label: 'Reports', icon: BarChart3, href: 'reports' },
  { value: 'competitors', label: 'Competitors', icon: Target, href: 'competitors' },
  { value: 'audit', label: 'Audit', icon: ClipboardCheck, href: 'audit' },
  { value: 'activity', label: 'Activity', icon: Activity, href: 'activity' },
]

export default function ClientDetailPage({
  params,
}: {
  params: { clientId: string }
}) {
  const { clientId } = params
  const router = useRouter()
  const [client, setClient] = useState<ClientDetail | null>(null)
  const [stats, setStats] = useState<QuickStats | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchClient() {
      const supabase = createClient()

      // Fetch client details
      const { data: clientData, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (error || !clientData) {
        console.error('Failed to fetch client:', error)
        setLoading(false)
        return
      }

      setClient(clientData)

      // Fetch quick stats
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

      const [locationsRes, postsRes, ratingsRes, reviewsRes] = await Promise.all([
        supabase
          .from('gbp_locations')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientId),
        supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .gte('created_at', startOfMonth),
        supabase
          .from('gbp_locations')
          .select('average_rating')
          .eq('client_id', clientId)
          .not('average_rating', 'is', null),
        supabase
          .from('reviews')
          .select('*', { count: 'exact', head: true })
          .eq('client_id', clientId)
          .eq('response_status', 'pending'),
      ])

      const avgRating = ratingsRes.data && ratingsRes.data.length > 0
        ? ratingsRes.data.reduce((sum, l) => sum + (l.average_rating || 0), 0) / ratingsRes.data.length
        : 0

      setStats({
        locationsCount: locationsRes.count || 0,
        postsThisMonth: postsRes.count || 0,
        averageRating: Math.round(avgRating * 10) / 10,
        pendingReviews: reviewsRes.count || 0,
      })

      // Fetch recent activity
      const { data: activityData } = await supabase
        .from('activity_log')
        .select('id, actor_type, action, entity_type, created_at')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(10)

      setActivities(activityData || [])
      setLoading(false)
    }

    fetchClient()
  }, [clientId])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.push('/admin/clients')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Client not found.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/admin/clients')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                {client.name}
              </h1>
              <StatusBadge status={client.status} />
              <Badge variant="outline" className="capitalize">
                {client.package}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Created {formatDate(client.created_at)}
            </p>
          </div>
        </div>
        <Button variant="outline">
          <Pencil className="mr-2 h-4 w-4" />
          Edit Client
        </Button>
      </div>

      {/* Tab Navigation */}
      <Tabs defaultValue="overview">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {clientTabs.map((tab) => {
            const Icon = tab.icon
            if (tab.href) {
              return (
                <Link
                  key={tab.value}
                  href={`/admin/clients/${clientId}/${tab.href}`}
                >
                  <TabsTrigger value={tab.value} asChild>
                    <span className="flex items-center gap-1.5 cursor-pointer">
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </span>
                  </TabsTrigger>
                </Link>
              )
            }
            return (
              <TabsTrigger key={tab.value} value={tab.value}>
                <Icon className="mr-1.5 h-3.5 w-3.5" />
                {tab.label}
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <KPICard
              title="Locations"
              value={stats?.locationsCount ?? 0}
              icon={MapPin}
            />
            <KPICard
              title="Posts This Month"
              value={stats?.postsThisMonth ?? 0}
              icon={FileText}
            />
            <KPICard
              title="Average Rating"
              value={stats?.averageRating ? `${stats.averageRating.toFixed(1)}` : '-'}
              icon={Star}
            />
            <KPICard
              title="Pending Reviews"
              value={stats?.pendingReviews ?? 0}
              icon={MessageSquare}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Client Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Client Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {client.contact_name && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Contact</p>
                      <p className="text-sm text-muted-foreground">{client.contact_name}</p>
                    </div>
                  </div>
                )}

                {client.contact_email && (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Email</p>
                      <a
                        href={`mailto:${client.contact_email}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {client.contact_email}
                      </a>
                    </div>
                  </div>
                )}

                {client.contact_phone && (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Phone</p>
                      <p className="text-sm text-muted-foreground">{client.contact_phone}</p>
                    </div>
                  </div>
                )}

                {client.website && (
                  <div className="flex items-center gap-3">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Website</p>
                      <a
                        href={client.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline"
                      >
                        {client.website}
                      </a>
                    </div>
                  </div>
                )}

                {client.industry && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Industry</p>
                      <p className="text-sm text-muted-foreground capitalize">{client.industry}</p>
                    </div>
                  </div>
                )}

                {client.address && (client.address.line1 || client.address.city) && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-sm font-medium">Address</p>
                      <p className="text-sm text-muted-foreground">
                        {[
                          client.address.line1,
                          client.address.city,
                          client.address.county,
                          client.address.postcode,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                    </div>
                  </div>
                )}

                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Package</span>
                    <span className="font-medium capitalize">{client.package}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-muted-foreground">Monthly Fee</span>
                    <span className="font-medium">
                      {formatCurrency(client.monthly_fee || 0)}
                    </span>
                  </div>
                </div>

                {client.tags && client.tags.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <p className="text-sm font-medium mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {client.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Brand Voice & Notes */}
            <div className="space-y-6">
              {client.brand_voice && (
                <Card>
                  <CardHeader>
                    <CardTitle>Brand Voice</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 overflow-auto max-h-48">
                      {typeof client.brand_voice === 'string'
                        ? client.brand_voice
                        : JSON.stringify(client.brand_voice, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {client.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle>Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {client.notes}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Recent Activity
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {activities.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No recent activity
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {activities.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 text-sm"
                        >
                          <div className="h-2 w-2 rounded-full bg-primary shrink-0" />
                          <span className="flex-1">
                            <span className="font-medium capitalize">
                              {item.actor_type}
                            </span>{' '}
                            {item.action}{' '}
                            <span className="text-muted-foreground">
                              {item.entity_type}
                            </span>
                          </span>
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
