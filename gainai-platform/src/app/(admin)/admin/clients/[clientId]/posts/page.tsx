'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ArrowLeft,
  Plus,
  List,
  CalendarDays,
  Eye,
  MousePointerClick,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate, formatTimeAgo } from '@/lib/utils/dates'

interface PostRow {
  id: string
  title: string | null
  content_type: string
  status: string
  scheduled_at: string | null
  published_at: string | null
  views: number | null
  clicks: number | null
  summary: string | null
  created_at: string
}

interface ClientInfo {
  id: string
  name: string
}

const contentTypeColors: Record<string, string> = {
  standard: 'bg-blue-100 text-blue-800 border-blue-200',
  event: 'bg-purple-100 text-purple-800 border-purple-200',
  offer: 'bg-green-100 text-green-800 border-green-200',
  product: 'bg-orange-100 text-orange-800 border-orange-200',
  alert: 'bg-red-100 text-red-800 border-red-200',
}

export default function ClientPostsPage({
  params,
}: {
  params: { clientId: string }
}) {
  const { clientId } = params
  const router = useRouter()
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [posts, setPosts] = useState<PostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [clientRes, postsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name')
          .eq('id', clientId)
          .single(),
        (() => {
          let query = supabase
            .from('posts')
            .select('id, title, content_type, status, scheduled_at, published_at, views, clicks, summary, created_at')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })

          if (statusFilter !== 'all') {
            query = query.eq('status', statusFilter)
          }
          if (typeFilter !== 'all') {
            query = query.eq('content_type', typeFilter)
          }

          return query
        })(),
      ])

      if (clientRes.data) setClient(clientRes.data)
      if (postsRes.data) setPosts(postsRes.data)

      setLoading(false)
    }

    fetchData()
  }, [clientId, statusFilter, typeFilter])

  const columns: ColumnDef<PostRow, unknown>[] = [
    {
      accessorKey: 'title',
      header: 'Title',
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.title || row.original.summary?.slice(0, 50) || 'Untitled'}
        </span>
      ),
    },
    {
      accessorKey: 'content_type',
      header: 'Type',
      cell: ({ row }) => (
        <Badge
          variant="outline"
          className={`capitalize ${contentTypeColors[row.original.content_type] || ''}`}
        >
          {row.original.content_type}
        </Badge>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'scheduled_at',
      header: 'Scheduled For',
      cell: ({ row }) =>
        row.original.scheduled_at
          ? formatDate(row.original.scheduled_at, 'dd MMM yyyy HH:mm')
          : '-',
    },
    {
      accessorKey: 'published_at',
      header: 'Published At',
      cell: ({ row }) =>
        row.original.published_at
          ? formatDate(row.original.published_at, 'dd MMM yyyy HH:mm')
          : '-',
    },
    {
      accessorKey: 'views',
      header: 'Views',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{row.original.views ?? 0}</span>
        </div>
      ),
    },
    {
      accessorKey: 'clicks',
      header: 'Clicks',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <MousePointerClick className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{row.original.clicks ?? 0}</span>
        </div>
      ),
    },
  ]

  // Simple calendar view: group posts by date
  function renderCalendarView() {
    const grouped: Record<string, PostRow[]> = {}
    posts.forEach((post) => {
      const dateKey = post.scheduled_at
        ? formatDate(post.scheduled_at, 'yyyy-MM-dd')
        : post.published_at
          ? formatDate(post.published_at, 'yyyy-MM-dd')
          : 'unscheduled'
      if (!grouped[dateKey]) grouped[dateKey] = []
      grouped[dateKey].push(post)
    })

    const sortedDates = Object.keys(grouped).sort().reverse()

    return (
      <div className="space-y-4">
        {sortedDates.map((date) => (
          <Card key={date}>
            <CardContent className="pt-4">
              <h3 className="font-medium text-sm mb-3">
                {date === 'unscheduled'
                  ? 'Unscheduled'
                  : formatDate(date, 'EEEE, dd MMMM yyyy')}
              </h3>
              <div className="space-y-2">
                {grouped[date].map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className={`capitalize text-xs ${contentTypeColors[post.content_type] || ''}`}
                      >
                        {post.content_type}
                      </Badge>
                      <span className="text-sm font-medium">
                        {post.title || post.summary?.slice(0, 50) || 'Untitled'}
                      </span>
                    </div>
                    <StatusBadge status={post.status} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
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
            onClick={() => router.push(`/admin/clients/${clientId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
            <p className="text-muted-foreground">
              {client?.name || 'Loading...'} - Content Management
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-md border">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create Post
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Content Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="standard">Standard</SelectItem>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="offer">Offer</SelectItem>
            <SelectItem value="product">Product</SelectItem>
            <SelectItem value="alert">Alert</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No posts yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first post to get started.
            </p>
          </CardContent>
        </Card>
      ) : viewMode === 'list' ? (
        <DataTable
          columns={columns}
          data={posts}
          searchKey="title"
          searchPlaceholder="Search posts..."
          pageSize={15}
        />
      ) : (
        renderCalendarView()
      )}
    </div>
  )
}
