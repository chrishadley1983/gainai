'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Plus,
  LayoutGrid,
  List,
  Calendar,
  FileText,
  Sparkles,
  Upload,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

interface PostRow {
  id: string
  client_name: string
  client_id: string
  summary: string
  content_type: string
  status: string
  scheduled_at: string | null
  published_at: string | null
  created_at: string
}

interface ClientOption {
  id: string
  name: string
}

const KANBAN_COLUMNS = [
  { key: 'DRAFT', label: 'Draft', color: 'border-t-yellow-400' },
  { key: 'PENDING_REVIEW', label: 'Pending Review', color: 'border-t-orange-400' },
  { key: 'APPROVED', label: 'Approved', color: 'border-t-blue-400' },
  { key: 'SCHEDULED', label: 'Scheduled', color: 'border-t-indigo-400' },
  { key: 'PUBLISHED', label: 'Published', color: 'border-t-emerald-400' },
  { key: 'FAILED', label: 'Failed', color: 'border-t-red-400' },
]

const contentTypeBadgeColor: Record<string, string> = {
  STANDARD: 'bg-slate-100 text-slate-700',
  EVENT: 'bg-purple-100 text-purple-700',
  OFFER: 'bg-amber-100 text-amber-700',
  PRODUCT: 'bg-cyan-100 text-cyan-700',
  ALERT: 'bg-red-100 text-red-700',
}

const tableColumns: ColumnDef<PostRow, unknown>[] = [
  {
    accessorKey: 'client_name',
    header: 'Client',
  },
  {
    accessorKey: 'summary',
    header: 'Preview',
    cell: ({ row }) => (
      <span className="line-clamp-1 max-w-xs">
        {row.original.summary?.slice(0, 80) || 'No content'}
      </span>
    ),
  },
  {
    accessorKey: 'content_type',
    header: 'Type',
    cell: ({ row }) => {
      const ct = row.original.content_type
      return (
        <Badge variant="outline" className={cn('capitalize', contentTypeBadgeColor[ct])}>
          {ct?.toLowerCase().replace('_', ' ')}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: 'scheduled_at',
    header: 'Date',
    cell: ({ row }) => {
      const date = row.original.published_at || row.original.scheduled_at || row.original.created_at
      return date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'
    },
  },
]

export default function AdminPostsPage() {
  const [posts, setPosts] = useState<PostRow[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [filterClient, setFilterClient] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [postsRes, clientsRes] = await Promise.all([
        supabase
          .from('posts')
          .select('id, summary, content_type, status, scheduled_at, published_at, created_at, client_id, clients(name)')
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('clients').select('id, name').order('name'),
      ])

      if (postsRes.data) {
        setPosts(
          postsRes.data.map((p: any) => ({
            id: p.id,
            client_name: p.clients?.name ?? 'Unknown',
            client_id: p.client_id,
            summary: p.summary ?? '',
            content_type: p.content_type ?? 'STANDARD',
            status: p.status ?? 'DRAFT',
            scheduled_at: p.scheduled_at,
            published_at: p.published_at,
            created_at: p.created_at,
          }))
        )
      }

      if (clientsRes.data) {
        setClients(clientsRes.data.map((c: any) => ({ id: c.id, name: c.name })))
      }

      setLoading(false)
    }

    load()
  }, [])

  const filtered = posts.filter((p) => {
    if (filterClient !== 'all' && p.client_id !== filterClient) return false
    if (filterStatus !== 'all' && p.status !== filterStatus) return false
    if (filterType !== 'all' && p.content_type !== filterType) return false
    if (search && !p.summary.toLowerCase().includes(search.toLowerCase()) && !p.client_name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const grouped = KANBAN_COLUMNS.reduce<Record<string, PostRow[]>>((acc, col) => {
    acc[col.key] = filtered.filter((p) => p.status === col.key)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
          <p className="text-sm text-muted-foreground">
            Manage posts across all clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/posts/calendar">
            <Button variant="outline" size="sm">
              <Calendar className="h-4 w-4 mr-1" />
              Calendar
            </Button>
          </Link>
          <Link href="/admin/posts/templates">
            <Button variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-1" />
              Templates
            </Button>
          </Link>
          <Link href="/admin/posts/generate">
            <Button variant="outline" size="sm">
              <Sparkles className="h-4 w-4 mr-1" />
              Generate
            </Button>
          </Link>
          <Link href="/admin/posts/import">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
          </Link>
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            Create Post
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search posts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
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
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {KANBAN_COLUMNS.map((col) => (
              <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="STANDARD">Standard</SelectItem>
            <SelectItem value="EVENT">Event</SelectItem>
            <SelectItem value="OFFER">Offer</SelectItem>
            <SelectItem value="PRODUCT">Product</SelectItem>
            <SelectItem value="ALERT">Alert</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1 rounded-md border p-0.5">
          <Button
            variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('kanban')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ))}
        </div>
      ) : viewMode === 'kanban' ? (
        filtered.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No posts found"
            description="Create your first post or adjust filters."
            action={
              <Button>
                <Plus className="h-4 w-4 mr-1" />
                Create Post
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {KANBAN_COLUMNS.map((col) => (
              <div key={col.key} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">{col.label}</h3>
                  <Badge variant="outline" className="text-xs">
                    {grouped[col.key]?.length ?? 0}
                  </Badge>
                </div>
                <div className={cn('space-y-2 min-h-[200px]')}>
                  {(grouped[col.key] ?? []).map((post) => (
                    <Card
                      key={post.id}
                      className={cn(
                        'cursor-pointer border-t-2 transition-shadow hover:shadow-md',
                        col.color
                      )}
                    >
                      <CardContent className="p-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          {post.client_name}
                        </p>
                        <p className="text-sm line-clamp-2">
                          {post.summary?.slice(0, 80) || 'No content'}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge
                            variant="outline"
                            className={cn(
                              'text-[10px] capitalize',
                              contentTypeBadgeColor[post.content_type]
                            )}
                          >
                            {post.content_type?.toLowerCase().replace('_', ' ')}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(
                              post.published_at || post.scheduled_at || post.created_at
                            ).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <DataTable
          columns={tableColumns}
          data={filtered}
          searchKey="client_name"
          searchPlaceholder="Search by client..."
        />
      )}
    </div>
  )
}
