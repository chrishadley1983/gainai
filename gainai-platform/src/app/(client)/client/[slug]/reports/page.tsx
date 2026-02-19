'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  Download,
  Calendar,
  FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils/dates'
import { truncateText } from '@/lib/utils/formatting'

interface ReportItem {
  id: string
  report_type: string
  period_start: string
  period_end: string
  created_at: string
  summary: string | null
  pdf_url: string | null
}

const reportTypeColors: Record<string, string> = {
  monthly: 'bg-blue-100 text-blue-800',
  quarterly: 'bg-purple-100 text-purple-800',
  annual: 'bg-emerald-100 text-emerald-800',
  custom: 'bg-orange-100 text-orange-800',
}

export default function ReportsPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [reports, setReports] = useState<ReportItem[]>([])

  useEffect(() => {
    async function loadReports() {
      setLoading(true)

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!client) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('reports')
        .select('id, report_type, period_start, period_end, created_at, summary, pdf_url')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })

      setReports(data || [])
      setLoading(false)
    }

    loadReports()
  }, [slug, supabase])

  function handleDownload(pdfUrl: string | null) {
    if (!pdfUrl) return
    window.open(pdfUrl, '_blank')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">
          View your performance reports and insights
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No reports yet"
          description="Your first performance report will appear here once it has been generated."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((report) => (
            <Card key={report.id} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge
                    className={cn(
                      reportTypeColors[report.report_type.toLowerCase()] ||
                        'bg-gray-100 text-gray-800'
                    )}
                  >
                    {report.report_type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(report.created_at)}
                  </span>
                </div>
                <CardTitle className="text-base mt-2">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(report.period_start, 'dd MMM')} &ndash;{' '}
                    {formatDate(report.period_end, 'dd MMM yyyy')}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                {report.summary && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {truncateText(report.summary, 120)}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-auto">
                  <Link href={`/client/${slug}/reports/${report.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <FileText className="h-3.5 w-3.5 mr-1" />
                      View Report
                    </Button>
                  </Link>
                  {report.pdf_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(report.pdf_url)}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
