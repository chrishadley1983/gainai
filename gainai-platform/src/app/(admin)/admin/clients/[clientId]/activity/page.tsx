'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Activity,
  User,
  Bot,
  Settings,
  Globe,
  FileText,
  MessageSquare,
  Image,
  Star,
  MapPin,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate, formatTimeAgo } from '@/lib/utils/dates'

interface ActivityItem {
  id: string
  actor_type: string
  actor_name: string | null
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown> | null
  created_at: string
}

interface ClientInfo {
  id: string
  name: string
}

const actorIcons: Record<string, typeof User> = {
  user: User,
  admin: User,
  system: Settings,
  ai: Bot,
  google: Globe,
}

const entityIcons: Record<string, typeof Activity> = {
  post: FileText,
  review: MessageSquare,
  media: Image,
  location: MapPin,
  audit: Star,
  client: User,
}

const actorColors: Record<string, string> = {
  user: 'bg-blue-100 text-blue-600',
  admin: 'bg-purple-100 text-purple-600',
  system: 'bg-gray-100 text-gray-600',
  ai: 'bg-emerald-100 text-emerald-600',
  google: 'bg-red-100 text-red-600',
}

export default function ClientActivityPage({
  params,
}: {
  params: { clientId: string }
}) {
  const { clientId } = params
  const router = useRouter()
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [actorFilter, setActorFilter] = useState<string>('all')

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const clientRes = await supabase
        .from('clients')
        .select('id, name')
        .eq('id', clientId)
        .single()

      let query = supabase
        .from('activity_log')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(100)

      if (actorFilter !== 'all') {
        query = query.eq('actor_type', actorFilter)
      }

      const activityRes = await query

      if (clientRes.data) setClient(clientRes.data)
      if (activityRes.data) setActivities(activityRes.data)

      setLoading(false)
    }

    fetchData()
  }, [clientId, actorFilter])

  // Group activities by date
  function groupByDate(items: ActivityItem[]): Record<string, ActivityItem[]> {
    const groups: Record<string, ActivityItem[]> = {}
    items.forEach((item) => {
      const dateKey = formatDate(item.created_at, 'yyyy-MM-dd')
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(item)
    })
    return groups
  }

  const grouped = groupByDate(activities)
  const sortedDates = Object.keys(grouped).sort().reverse()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/admin/clients/${clientId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
            <p className="text-muted-foreground">
              {client?.name || 'Loading...'} - All Activity
            </p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={actorFilter} onValueChange={setActorFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Actor Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actors</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="system">System</SelectItem>
            <SelectItem value="ai">AI</SelectItem>
            <SelectItem value="google">Google</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity Timeline */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Activity className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No activity found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Activity will appear here as actions are taken on this client.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 sticky top-0 bg-background py-1">
                {formatDate(date, 'EEEE, dd MMMM yyyy')}
              </h3>
              <div className="space-y-2">
                {grouped[date].map((item) => {
                  const ActorIcon = actorIcons[item.actor_type] || User
                  const EntityIcon = entityIcons[item.entity_type] || Activity
                  const iconColor = actorColors[item.actor_type] || 'bg-gray-100 text-gray-600'

                  return (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconColor}`}
                      >
                        <ActorIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium capitalize">
                            {item.actor_name || item.actor_type}
                          </span>{' '}
                          {item.action}{' '}
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <EntityIcon className="inline h-3.5 w-3.5" />
                            {item.entity_type}
                          </span>
                        </p>
                        {item.metadata && Object.keys(item.metadata).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(item.metadata).map(([key, value]) => (
                              <Badge
                                key={key}
                                variant="outline"
                                className="text-xs text-muted-foreground"
                              >
                                {key}: {String(value)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(item.created_at, 'HH:mm')}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
