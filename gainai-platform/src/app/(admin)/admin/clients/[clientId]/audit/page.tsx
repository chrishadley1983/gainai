'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  ClipboardCheck,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Info,
  Calendar,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { formatDate, formatTimeAgo } from '@/lib/utils/dates'

interface AuditResult {
  id: string
  overall_grade: string
  overall_score: number
  category_scores: Record<string, number>
  recommendations: string[]
  narrative: string | null
  created_at: string
}

interface ClientInfo {
  id: string
  name: string
}

const gradeColors: Record<string, string> = {
  'A+': 'bg-emerald-500 text-white',
  A: 'bg-emerald-500 text-white',
  'A-': 'bg-emerald-400 text-white',
  'B+': 'bg-green-500 text-white',
  B: 'bg-green-500 text-white',
  'B-': 'bg-green-400 text-white',
  'C+': 'bg-yellow-500 text-white',
  C: 'bg-yellow-500 text-white',
  'C-': 'bg-yellow-400 text-white',
  'D+': 'bg-orange-500 text-white',
  D: 'bg-orange-500 text-white',
  'D-': 'bg-orange-400 text-white',
  F: 'bg-red-500 text-white',
}

const categoryLabels: Record<string, string> = {
  profile_completeness: 'Profile Completeness',
  review_management: 'Review Management',
  post_frequency: 'Post Frequency',
  photo_quality: 'Photo Quality',
  response_rate: 'Response Rate',
  seo_optimization: 'SEO Optimisation',
  category_accuracy: 'Category Accuracy',
  business_info: 'Business Information',
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500'
  if (score >= 60) return 'bg-green-500'
  if (score >= 40) return 'bg-yellow-500'
  if (score >= 20) return 'bg-orange-500'
  return 'bg-red-500'
}

export default function ClientAuditPage({
  params,
}: {
  params: { clientId: string }
}) {
  const { clientId } = params
  const router = useRouter()
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [latestAudit, setLatestAudit] = useState<AuditResult | null>(null)
  const [auditHistory, setAuditHistory] = useState<AuditResult[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [clientRes, auditsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name')
          .eq('id', clientId)
          .single(),
        supabase
          .from('gbp_audits')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false }),
      ])

      if (clientRes.data) setClient(clientRes.data)

      if (auditsRes.data && auditsRes.data.length > 0) {
        setLatestAudit(auditsRes.data[0])
        setAuditHistory(auditsRes.data)
      }

      setLoading(false)
    }

    fetchData()
  }, [clientId])

  async function handleRunAudit() {
    setRunning(true)
    // In a real implementation, this would trigger an audit via API
    await new Promise((resolve) => setTimeout(resolve, 3000))
    setRunning(false)
    // Re-fetch audit data
    window.location.reload()
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
            <h1 className="text-3xl font-bold tracking-tight">Audit</h1>
            <p className="text-muted-foreground">
              {client?.name || 'Loading...'} - GBP Audit Scorecard
            </p>
          </div>
        </div>
        <Button onClick={handleRunAudit} disabled={running}>
          {running ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Play className="mr-2 h-4 w-4" />
          )}
          Run Audit
        </Button>
      </div>

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-48" />
          <Skeleton className="h-96" />
        </div>
      ) : !latestAudit ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ClipboardCheck className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No audits yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Run your first audit to get a comprehensive GBP scorecard.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Latest Audit Scorecard */}
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Overall Grade */}
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-sm text-muted-foreground mb-3">Overall Grade</p>
                <div
                  className={cn(
                    'mx-auto flex h-24 w-24 items-center justify-center rounded-full text-4xl font-bold',
                    gradeColors[latestAudit.overall_grade] || 'bg-gray-500 text-white'
                  )}
                >
                  {latestAudit.overall_grade}
                </div>
                <p className="mt-3 text-2xl font-bold">
                  {latestAudit.overall_score}/100
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Last audited {formatTimeAgo(latestAudit.created_at)}
                </p>
              </CardContent>
            </Card>

            {/* Category Scores */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Category Scores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {latestAudit.category_scores &&
                  Object.entries(latestAudit.category_scores).map(
                    ([category, score]) => (
                      <div key={category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">
                            {categoryLabels[category] || category}
                          </span>
                          <span className="text-muted-foreground">{score}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all duration-500',
                              getScoreColor(score)
                            )}
                            style={{ width: `${Math.min(score, 100)}%` }}
                          />
                        </div>
                      </div>
                    )
                  )}
              </CardContent>
            </Card>
          </div>

          {/* Recommendations */}
          {latestAudit.recommendations && latestAudit.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-500" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {latestAudit.recommendations.map((rec, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                        {index + 1}
                      </div>
                      <p className="text-sm">{rec}</p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* AI Narrative */}
          {latestAudit.narrative && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary" />
                  AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {latestAudit.narrative}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Audit History */}
          {auditHistory.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle>Audit History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {auditHistory.map((audit) => (
                    <div
                      key={audit.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-3',
                        audit.id === latestAudit.id && 'border-primary/50 bg-primary/5'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold',
                            gradeColors[audit.overall_grade] || 'bg-gray-500 text-white'
                          )}
                        >
                          {audit.overall_grade}
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            Score: {audit.overall_score}/100
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(audit.created_at, 'dd MMM yyyy HH:mm')}
                          </p>
                        </div>
                      </div>
                      {audit.id === latestAudit.id && (
                        <Badge variant="secondary" className="text-xs">
                          Latest
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
