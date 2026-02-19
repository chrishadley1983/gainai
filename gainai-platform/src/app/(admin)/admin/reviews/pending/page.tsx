'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  SkipForward,
  Keyboard,
  Check,
  Sparkles,
  Loader2,
  Inbox,
} from 'lucide-react'

interface ReviewRow {
  id: string
  client_id: string
  client_name: string
  reviewer_name: string
  star_rating: number
  comment: string | null
  reviewed_at: string
  response_status: string
  ai_draft_response: string | null
  response_body: string | null
  sentiment: string | null
}

export default function PendingReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [responseText, setResponseText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data } = await supabase
        .from('reviews')
        .select('id, client_id, reviewer_name, star_rating, comment, reviewed_at, response_status, sentiment, clients(name), review_responses(body)')
        .in('response_status', ['PENDING', 'DRAFTED'])
        .order('reviewed_at', { ascending: false })
        .limit(200)

      if (data) {
        setReviews(
          data.map((r: any) => ({
            id: r.id,
            client_id: r.client_id,
            client_name: r.clients?.name ?? 'Unknown',
            reviewer_name: r.reviewer_name ?? 'Anonymous',
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

      setLoading(false)
    }
    load()
  }, [])

  const selectedReview = reviews.find((r) => r.id === selectedId)

  useEffect(() => {
    if (selectedReview) {
      setResponseText(selectedReview.response_body || selectedReview.ai_draft_response || '')
    }
  }, [selectedId])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return

      const currentIndex = reviews.findIndex((r) => r.id === selectedId)

      if (e.key === 'j' || e.key === 'J') {
        e.preventDefault()
        const nextIndex = Math.min(currentIndex + 1, reviews.length - 1)
        if (reviews[nextIndex]) setSelectedId(reviews[nextIndex].id)
      }
      if (e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        const prevIndex = Math.max(currentIndex - 1, 0)
        if (reviews[prevIndex]) setSelectedId(reviews[prevIndex].id)
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
  }, [selectedId, reviews])

  async function handleApprove() {
    if (!selectedReview || !responseText.trim()) return
    setSaving(true)
    const supabase = createClient()

    await supabase
      .from('reviews')
      .update({ response_status: 'APPROVED' })
      .eq('id', selectedReview.id)

    setReviews((prev) => prev.filter((r) => r.id !== selectedReview.id))

    const currentIndex = reviews.findIndex((r) => r.id === selectedId)
    const next = reviews[currentIndex + 1]
    setSelectedId(next?.id ?? null)

    setSaving(false)
  }

  async function handleSkip() {
    if (!selectedReview) return
    const supabase = createClient()

    await supabase
      .from('reviews')
      .update({ response_status: 'SKIPPED' })
      .eq('id', selectedReview.id)

    setReviews((prev) => prev.filter((r) => r.id !== selectedReview.id))

    const currentIndex = reviews.findIndex((r) => r.id === selectedId)
    const next = reviews[currentIndex + 1]
    setSelectedId(next?.id ?? null)
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pending Reviews</h1>
          <p className="text-sm text-muted-foreground">
            {reviews.length} review{reviews.length !== 1 ? 's' : ''} awaiting response
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

      {loading ? (
        <div className="grid grid-cols-5 gap-4 h-[calc(100vh-220px)]">
          <div className="col-span-2 space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
          <div className="col-span-3">
            <Skeleton className="h-full w-full" />
          </div>
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="All caught up!"
          description="No pending reviews need your attention right now."
        />
      ) : (
        <div className="grid grid-cols-5 gap-4 h-[calc(100vh-220px)]">
          {/* Left panel */}
          <ScrollArea className="col-span-2 rounded-md border">
            <div className="divide-y">
              {reviews.map((review) => (
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
                      <p className="text-xs font-medium text-muted-foreground">
                        {review.client_name}
                      </p>
                      <p className="mt-0.5 text-sm font-medium truncate">
                        {review.reviewer_name}
                      </p>
                      <StarRating rating={review.star_rating} size="sm" />
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

          {/* Right panel */}
          <div className="col-span-3 rounded-md border p-5 overflow-y-auto">
            {selectedReview ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs text-muted-foreground">{selectedReview.client_name}</p>
                  <h3 className="text-lg font-semibold">{selectedReview.reviewer_name}</h3>
                  <StarRating rating={selectedReview.star_rating} size="md" showValue />
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(selectedReview.reviewed_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                <div className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm">{selectedReview.comment || 'No comment provided.'}</p>
                </div>

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
