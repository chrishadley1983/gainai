'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { MapPin, Upload, Activity } from 'lucide-react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'

interface LocationRow {
  id: string
  client_id: string
  client_name: string
  name: string
  address: string
  status: string
  primary_category: string | null
  last_synced_at: string | null
}

interface ClientOption {
  id: string
  name: string
}

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<LocationRow[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filterClient, setFilterClient] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [locsRes, clientsRes] = await Promise.all([
        supabase
          .from('gbp_locations')
          .select('id, client_id, name, address, status, primary_category, last_synced_at, clients(name)')
          .order('name')
          .limit(500),
        supabase.from('clients').select('id, name').order('name'),
      ])

      if (locsRes.data) {
        setLocations(
          locsRes.data.map((l: any) => ({
            id: l.id,
            client_id: l.client_id,
            client_name: l.clients?.name ?? 'Unknown',
            name: l.name ?? '',
            address: l.address ?? '',
            status: l.status ?? 'ACTIVE',
            primary_category: l.primary_category,
            last_synced_at: l.last_synced_at,
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

  const filtered = locations.filter((l) => {
    if (filterClient !== 'all' && l.client_id !== filterClient) return false
    if (filterStatus !== 'all' && l.status !== filterStatus) return false
    return true
  })

  const columns: ColumnDef<LocationRow, unknown>[] = [
    {
      accessorKey: 'client_name',
      header: 'Client',
      cell: ({ row }) => <span className="font-medium">{row.original.client_name}</span>,
    },
    {
      accessorKey: 'name',
      header: 'Location Name',
    },
    {
      accessorKey: 'address',
      header: 'Address',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
          {row.original.address}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      accessorKey: 'primary_category',
      header: 'Category',
      cell: ({ row }) =>
        row.original.primary_category ? (
          <Badge variant="outline" className="text-xs">
            {row.original.primary_category}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: 'last_synced_at',
      header: 'Last Synced',
      cell: ({ row }) =>
        row.original.last_synced_at
          ? new Date(row.original.last_synced_at).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : 'Never',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Locations</h1>
          <p className="text-sm text-muted-foreground">
            All locations across all clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/locations/health">
            <Button variant="outline" size="sm">
              <Activity className="h-4 w-4 mr-1" />
              Health Dashboard
            </Button>
          </Link>
          <Link href="/admin/locations/import">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
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
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
            <SelectItem value="DISCONNECTED">Disconnected</SelectItem>
            <SelectItem value="PENDING_VERIFICATION">Pending Verification</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No locations found"
          description="Add locations or adjust your filters."
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          searchKey="name"
          searchPlaceholder="Search locations..."
        />
      )}
    </div>
  )
}
