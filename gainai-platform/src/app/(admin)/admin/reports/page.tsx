'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart3,
  Plus,
  Download,
  Eye,
  Loader2,
} from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

interface ReportRow {
  id: string
  client_id: string
  client_name: string
  report_type: string
  period: string
  created_at: string
  sent_status: string
}

interface ClientOption {
  id: string
  name: string
}

const REPORT_TYPES = [
  'Performance Summary',
  'Review Analysis',
  'Post Engagement',
  'Competitor Analysis',
  'Monthly Digest',
  'Quarterly Review',
]

const PERIODS = ['Weekly', 'Monthly', 'Quarterly', 'Annual', 'Custom']

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Filters
  const [filterClient, setFilterClient] = useState<string>('all')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterPeriod, setFilterPeriod] = useState<string>('all')

  // Generate form
  const [genClient, setGenClient] = useState<string>('')
  const [genType, setGenType] = useState<string>('Performance Summary')
  const [genDateFrom, setGenDateFrom] = useState('')
  const [genDateTo, setGenDateTo] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [reportsRes, clientsRes] = await Promise.all([
        supabase
          .from('reports')
          .select('id, client_id, report_type, period, created_at, sent_status, clients(name)')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('clients').select('id, name').order('name'),
      ])

      if (reportsRes.data) {
        setReports(
          reportsRes.data.map((r: any) => ({
            id: r.id,
            client_id: r.client_id,
            client_name: r.clients?.name ?? 'Unknown',
            report_type: r.report_type ?? '',
            period: r.period ?? '',
            created_at: r.created_at,
            sent_status: r.sent_status ?? 'DRAFT',
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

  const filtered = reports.filter((r) => {
    if (filterClient !== 'all' && r.client_id !== filterClient) return false
    if (filterType !== 'all' && r.report_type !== filterType) return false
    if (filterPeriod !== 'all' && r.period !== filterPeriod) return false
    return true
  })

  async function handleGenerate() {
    if (!genClient) return
    setGenerating(true)

    const supabase = createClient()

    await supabase.from('reports').insert({
      client_id: genClient,
      report_type: genType,
      period: `${genDateFrom || 'start'} to ${genDateTo || 'now'}`,
      sent_status: 'DRAFT',
    })

    // Simulate generation time
    await new Promise((resolve) => setTimeout(resolve, 1500))

    setDialogOpen(false)
    setGenerating(false)

    // Reload
    const { data } = await supabase
      .from('reports')
      .select('id, client_id, report_type, period, created_at, sent_status, clients(name)')
      .order('created_at', { ascending: false })
      .limit(200)

    if (data) {
      setReports(
        data.map((r: any) => ({
          id: r.id,
          client_id: r.client_id,
          client_name: r.clients?.name ?? 'Unknown',
          report_type: r.report_type ?? '',
          period: r.period ?? '',
          created_at: r.created_at,
          sent_status: r.sent_status ?? 'DRAFT',
        }))
      )
    }
  }

  const columns: ColumnDef<ReportRow, unknown>[] = [
    {
      accessorKey: 'client_name',
      header: 'Client',
      cell: ({ row }) => <span className="font-medium">{row.original.client_name}</span>,
    },
    {
      accessorKey: 'report_type',
      header: 'Report Type',
      cell: ({ row }) => (
        <Badge variant="outline">{row.original.report_type}</Badge>
      ),
    },
    {
      accessorKey: 'period',
      header: 'Period',
    },
    {
      accessorKey: 'created_at',
      header: 'Created',
      cell: ({ row }) =>
        new Date(row.original.created_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      accessorKey: 'sent_status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.sent_status} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Generate and manage client reports
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          Generate Report
        </Button>
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
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {REPORT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Periods" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Periods</SelectItem>
            {PERIODS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No reports found"
          description="Generate your first report or adjust your filters."
          action={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Generate Report
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          searchKey="client_name"
          searchPlaceholder="Search by client..."
        />
      )}

      {/* Generate Report Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Report</DialogTitle>
            <DialogDescription>
              Create a new report for a client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={genClient} onValueChange={setGenClient}>
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Report Type</Label>
              <Select value={genType} onValueChange={setGenType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Date From</Label>
                <Input
                  type="date"
                  value={genDateFrom}
                  onChange={(e) => setGenDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Date To</Label>
                <Input
                  type="date"
                  value={genDateTo}
                  onChange={(e) => setGenDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleGenerate} disabled={generating || !genClient}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
