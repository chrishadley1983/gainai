'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BarChart3,
  FileDown,
  Plus,
  Calendar,
  Mail,
  Check,
  Clock,
  Eye,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils/dates'

interface Report {
  id: string
  type: string
  period_start: string
  period_end: string
  status: string
  sent_at: string | null
  file_url: string | null
  created_at: string
}

interface ClientInfo {
  id: string
  name: string
}

const reportTypeLabels: Record<string, string> = {
  monthly: 'Monthly Report',
  quarterly: 'Quarterly Report',
  annual: 'Annual Report',
  performance: 'Performance Report',
  audit: 'Audit Report',
  competitor: 'Competitor Analysis',
}

const reportTypeIcons: Record<string, typeof BarChart3> = {
  monthly: Calendar,
  quarterly: Calendar,
  annual: Calendar,
  performance: BarChart3,
  audit: BarChart3,
  competitor: BarChart3,
}

export default function ClientReportsPage({
  params,
}: {
  params: { clientId: string }
}) {
  const { clientId } = params
  const router = useRouter()
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [clientRes, reportsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name')
          .eq('id', clientId)
          .single(),
        supabase
          .from('reports')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
      ])

      if (clientRes.data) setClient(clientRes.data)
      if (reportsRes.data) setReports(reportsRes.data)

      setLoading(false)
    }

    fetchData()
  }, [clientId])

  function handleGenerateReport() {
    // In a real implementation, this would trigger report generation
    console.log('Generating report for client:', clientId)
  }

  function handleDownload(report: Report) {
    if (report.file_url) {
      window.open(report.file_url, '_blank')
    }
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
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground">
              {client?.name || 'Loading...'} - Performance Reports
            </p>
          </div>
        </div>
        <Button onClick={handleGenerateReport}>
          <Plus className="mr-2 h-4 w-4" />
          Generate Report
        </Button>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No reports yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Generate your first report to track performance over time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => {
            const TypeIcon = reportTypeIcons[report.type] || BarChart3

            return (
              <Card key={report.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <TypeIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm">
                          {reportTypeLabels[report.type] || report.type}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(report.period_start, 'dd MMM yyyy')} -{' '}
                            {formatDate(report.period_end, 'dd MMM yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                          <Badge variant="outline" className="text-xs">
                            <Calendar className="mr-1 h-3 w-3" />
                            Created {formatDate(report.created_at, 'dd MMM yyyy')}
                          </Badge>
                          {report.sent_at ? (
                            <Badge variant="secondary" className="text-xs">
                              <Mail className="mr-1 h-3 w-3" />
                              Sent {formatDate(report.sent_at, 'dd MMM yyyy')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              <Clock className="mr-1 h-3 w-3" />
                              Not sent
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={report.status} />
                      <Button variant="ghost" size="sm">
                        <Eye className="mr-1.5 h-4 w-4" />
                        View
                      </Button>
                      {report.file_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(report)}
                        >
                          <FileDown className="mr-1.5 h-4 w-4" />
                          PDF
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
