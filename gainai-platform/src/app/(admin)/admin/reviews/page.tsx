'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { StarRating } from '@/components/shared/StarRating'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MessageSquare,
  Send,
  SkipForward,
  Keyboard,
  Pencil,
  Check,
  Sparkles,
  Loader2,
} from 'lucide-react'
import { DateRangePicker } from '@/components/shared/DateRangePicker'

interface ReviewRow {
  id: string
  client_id: string
  client_name: string
  reviewer_name: string
  reviewer_photo_url: string | null
  star_rating: number
  comment: string | null
  reviewed_at: string
  response_status: string
  ai_draft_response: string | null
  response_body: string | null
  sentiment: string | null
}

interface ClientOption {
  id: string
  name: string
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')
  const [saving, setSaving] = useState(false)

  // Filters
  const [filterClient, setFilterClient] = useState<string>('all')
  const [filterRating, setFilterRating] = useState<string>('all')
  const [filterSentiment, setFilterSentiment] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [reviewsRes, clientsRes] = await Promise.all([
        supabase
          .from('reviews')
          .select('id, client_id, reviewer_name, reviewer_photo_url, star_rating, comment, reviewed_at, response_status, sentiment, clients(name), review_responses(body)')
          .order('reviewed_at', { ascending: false })
          .limit(500),
        supabase.from('clients').select('id, name').order('name'),
      ])

      if (reviewsRes.data) {
        setReviews(
          reviewsRes.data.map((r: any) => ({
            id: r.id,
            client_id: r.client_id,
            client_name: r.clients?.name ?? 'Unknown',
            reviewer_name: r.reviewer_name ?? 'Anonymous',
            reviewer_photo_url: r.reviewer_photo_url,
            star_rating: r.star_rating ?? 0,
            comment: r.comment,
            reviewed_at: r.reviewed_at,
            response_status: r.response_status ?? 'PENDING',
            ai_draft_response: null,
            response_body: r.review_responses?.[0]?.body ?? null,
            sentiment: r.sentiment,
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

  const filtered = reviews.filter((r) => {
    if (filterClient !== 'all' && r.client_id !== filterClient) return false
    if (filterRating !== 'all' && r.star_rating !== parseInt(filterRating)) return false
    if (filterSentiment !== 'all' && r.sentiment !== filterSentiment) return false
    if (filterStatus !== 'all' && r.response_status !== filterStatus) return false
    if (dateRange.from && new Date(r.reviewed_at) < dateRange.from) return false
    if (dateRange.to && new Date(r.reviewed_at) > dateRange.to) return false
    if (
      search &&
      !r.comment?.toLowerCase().includes(search.toLowerCase()) &&
      !r.reviewer_name.toLowerCase().includes(search.toLowerCase()) &&
      !r.client_name.toLowerCase().includes(search.toLowerCase())
    )
      return false
    return true
  })

  const selectedReview = filtered.find((r) => r.id === selectedId)

  useEffect(() => {
    if (selectedReview) {
      setResponseText(selectedReview.response_body || selectedReview.ai_draft_response || '')
    }
  }, [selectedId])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return

      const currentIndex = filtered.findIndex((r) => r.id === selectedId)

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        const nextIndex = Math.min(currentIndex + 1, filtered.length - 1)
        if (filtered[nextIndex]) setSelectedId(filtered[nextIndex].id)
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        const prevIndex = Math.max(currentIndex - 1, 0)
        if (filtered[prevIndex]) setSelectedId(filtered[prevIndex].id)
      }
      if (e.key === 'a' || e.key === 'A') {
        if (selectedReview) handleApprove()
      }
      if (e.key === 's' || e.key === 'S') {
        if (selectedReview) handleSkip()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedId, filtered])

  async function handleApprove() {
    if (!selectedReview || !responseText.trim()) return
    setSaving(true)
    const supabase = createClient()

    await supabase
      .from('reviews')
      .update({ response_status: 'APPROVED' })
      .eq('id', selectedReview.id)

    setReviews((prev) =>
      prev.map((r) =>
        r.id === selectedReview.id
          ? { ...r, response_status: 'APPROVED', response_body: responseText }
          : r
      )
    )

    // Move to next
    const currentIndex = filtered.findIndex((r) => r.id === selectedId)
    const next = filtered[currentIndex + 1]
    if (next) setSelectedId(next.id)

    setSaving(false)
  }

  async function handleSkip() {
    if (!selectedReview) return
    const supabase = createClient()

    await supabase
      .from('reviews')
      .update({ response_status: 'SKIPPED' })
      .eq('id', selectedReview.id)

    setReviews((prev) =>
      prev.map((r) =>
        r.id === selectedReview.id ? { ...r, response_status: 'SKIPPED' } : r
      )
    )

    const currentIndex = filtered.findIndex((r) => r.id === selectedId)
    const next = filtered[currentIndex + 1]
    if (next) setSelectedId(next.id)
  }

  function timeAgo(dateStr: string): string {
    const now = new Date()
    const then = new Date(dateStr)
    const diff = Math.floor((now.getTime() - then.getTime()) / 1000)

    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
    return `${Math.floor(diff / 2592000)}mo ago`
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
          <p className="text-sm text-muted-foreground">
            Unified inbox for all client reviews
          </p>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm">
                <Keyboard className="h-4 w-4 mr-1" />
                Shortcuts
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs space-y-1 p-3">
              <p><kbd className="rounded border px-1 font-mono">J</kbd> / <kbd className="rounded border px-1 font-mono">K</kbd> Navigate reviews</p>
              <p><kbd className="rounded border px-1 font-mono">A</kbd> Approve response</p>
              <p><kbd className="rounded border px-1 font-mono">S</kbd> Skip review</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search reviews..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRating} onValueChange={setFilterRating}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="All Ratings" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            {[5, 4, 3, 2, 1].map((r) => (
              <SelectItem key={r} value={r.toString()}>{r} Stars</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterSentiment} onValueChange={setFilterSentiment}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="All Sentiment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sentiment</SelectItem>
            <SelectItem value="POSITIVE">Positive</SelectItem>
            <SelectItem value="NEUTRAL">Neutral</SelectItem>
            <SelectItem value="NEGATIVE">Negative</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="DRAFTED">Drafted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="SKIPPED">Skipped</SelectItem>
          </SelectContent>
        </Select>
        <DateRangePicker
          from={dateRange.from}
          to={dateRange.to}
          onChange={(range) => setDateRange(range)}
        />
      </div>

      {/* Two-panel layout */}
      {loading ? (
        <div className="grid grid-cols-5 gap-4 h-[calc(100vh-280px)]">
          <div className="col-span-2 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <div className="col-span-3">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No reviews found"
          description="Adjust your filters or wait for new reviews to come in."
        />
      ) : (
        <div className="grid grid-cols-5 gap-4 h-[calc(100vh-280px)]">
          {/* Left panel - review list */}
          <ScrollArea className="col-span-2 rounded-md border">
            <div className="divide-y">
              {filtered.map((review) => (
                <button
                  key={review.id}
                  onClick={() => setSelectedId(review.id)}
                  className={cn(
                    'w-full p-3 text-left transition-colors hover:bg-accent/50',
                    selectedId === review.id && 'bg-accent'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {review.client_name}
                        </span>
                        <StatusBadge status={review.response_status} />
                      </div>
                      <p className="mt-1 text-sm font-medium truncate">
                        {review.reviewer_name}
                      </p>
                      <div className="mt-0.5">
                        <StarRating rating={review.star_rating} size="sm" />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                        {review.comment || 'No comment'}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {timeAgo(review.reviewed_at)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Right panel - detail */}
          <div className="col-span-3 rounded-md border p-5 overflow-y-auto">
            {selectedReview ? (
              <div className="space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{selectedReview.client_name}</p>
                    <h3 className="text-lg font-semibold">{selectedReview.reviewer_name}</h3>
                    <StarRating rating={selectedReview.star_rating} size="md" showValue />
                  </div>
                  <div className="text-right">
                    <StatusBadge status={selectedReview.response_status} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(selectedReview.reviewed_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm">
                    {selectedReview.comment || 'No comment provided.'}
                  </p>
                </div>

                {selectedReview.sentiment && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">Sentiment:</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'capitalize',
                        selectedReview.sentiment === 'POSITIVE' && 'bg-emerald-50 text-emerald-700',
                        selectedReview.sentiment === 'NEGATIVE' && 'bg-red-50 text-red-700',
                        selectedReview.sentiment === 'NEUTRAL' && 'bg-gray-50 text-gray-700'
                      )}
                    >
                      {selectedReview.sentiment?.toLowerCase()}
                    </Badge>
                  </div>
                )}

                {selectedReview.ai_draft_response && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-700">AI Draft Response</span>
                    </div>
                    <p className="text-sm">{selectedReview.ai_draft_response}</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Response</label>
                  <Textarea
                    value={responseText}
                    onChange={(e) => setResponseText(e.target.value)}
                    placeholder="Write your response..."
                    rows={5}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={handleApprove} disabled={saving || !responseText.trim()}>
                    {saving ? (
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-1" />
                    )}
                    Approve
                  </Button>
                  <Button variant="outline" onClick={handleSkip}>
                    <SkipForward className="h-4 w-4 mr-1" />
                    Skip
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <p className="text-sm">Select a review to view details</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
