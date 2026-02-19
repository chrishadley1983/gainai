'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable } from '@/components/shared/DataTable'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ClipboardList, Eye, AlertCircle } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

interface BulkJobRow {
  id: string
  type: string
  created_by_id: string
  created_at: string
  total_items: number
  processed_items: number
  failed_items: number
  status: string
  errors: { itemIndex: number; message: string; code?: string }[]
}

export default function BulkJobsPage() {
  const [jobs, setJobs] = useState<BulkJobRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJob, setSelectedJob] = useState<BulkJobRow | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('bulk_jobs')
        .select('id, type, created_by_id, created_at, total_items, processed_items, failed_items, status, errors')
        .order('created_at', { ascending: false })
        .limit(200)

      if (data) {
        setJobs(
          data.map((j: any) => ({
            id: j.id,
            type: j.type ?? '',
            created_by_id: j.created_by_id ?? '',
            created_at: j.created_at,
            total_items: j.total_items ?? 0,
            processed_items: j.processed_items ?? 0,
            failed_items: j.failed_items ?? 0,
            status: j.status ?? 'PENDING',
            errors: j.errors ?? [],
          }))
        )
      }
      setLoading(false)
    }
    load()
  }, [])

  const columns: ColumnDef<BulkJobRow, unknown>[] = [
    {
      accessorKey: 'type',
      header: 'Job Type',
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.type.toLowerCase().replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Date',
      cell: ({ row }) =>
        new Date(row.original.created_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
    },
    {
      accessorKey: 'total_items',
      header: 'Total',
    },
    {
      id: 'success',
      header: 'Success',
      cell: ({ row }) => (
        <span className="text-emerald-600 font-medium">
          {row.original.processed_items - row.original.failed_items}
        </span>
      ),
    },
    {
      accessorKey: 'failed_items',
      header: 'Errors',
      cell: ({ row }) => (
        <span className={row.original.failed_items > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
          {row.original.failed_items}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedJob(row.original)}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bulk Job History</h1>
        <p className="text-sm text-muted-foreground">
          View all bulk operation jobs and their results
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No bulk jobs found"
          description="Bulk jobs will appear here after you run import or bulk operations."
        />
      ) : (
        <DataTable
          columns={columns}
          data={jobs}
          searchKey="type"
          searchPlaceholder="Search by job type..."
        />
      )}

      {/* Job detail dialog */}
      <Dialog open={!!selectedJob} onOpenChange={() => setSelectedJob(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription>
              {selectedJob && (
                <span className="capitalize">
                  {selectedJob.type.toLowerCase().replace(/_/g, ' ')} -{' '}
                  {new Date(selectedJob.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {selectedJob && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center rounded-lg border p-3">
                  <p className="text-2xl font-bold">{selectedJob.total_items}</p>
                  <p className="text-xs text-muted-foreground">Total Items</p>
                </div>
                <div className="text-center rounded-lg border p-3">
                  <p className="text-2xl font-bold text-emerald-600">
                    {selectedJob.processed_items - selectedJob.failed_items}
                  </p>
                  <p className="text-xs text-muted-foreground">Successful</p>
                </div>
                <div className="text-center rounded-lg border p-3">
                  <p className="text-2xl font-bold text-red-600">{selectedJob.failed_items}</p>
                  <p className="text-xs text-muted-foreground">Failed</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Status:</span>
                <StatusBadge status={selectedJob.status} />
              </div>

              {selectedJob.errors && selectedJob.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-red-700">
                      Error Log ({selectedJob.errors.length} errors)
                    </span>
                  </div>
                  <ScrollArea className="h-48 rounded-md border">
                    <div className="p-3 space-y-2">
                      {selectedJob.errors.map((err, idx) => (
                        <div
                          key={idx}
                          className="rounded bg-red-50 px-3 py-2 text-sm"
                        >
                          <span className="font-mono text-xs text-red-400 mr-2">
                            Row {err.itemIndex}
                          </span>
                          <span className="text-red-700">{err.message}</span>
                          {err.code && (
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              {err.code}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {(!selectedJob.errors || selectedJob.errors.length === 0) &&
                selectedJob.failed_items === 0 && (
                  <p className="text-sm text-muted-foreground">No errors recorded.</p>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
