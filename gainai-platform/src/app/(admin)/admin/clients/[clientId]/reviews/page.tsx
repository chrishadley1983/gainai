'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Star,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate, formatTimeAgo } from '@/lib/utils/dates'
import { truncateText } from '@/lib/utils/formatting'

interface ReviewRow {
  id: string
  reviewer_name: string
  reviewer_photo_url: string | null
  star_rating: number
  comment: string | null
  response_status: string
  response_body: string | null
  reviewed_at: string
  created_at: string
}

interface ClientInfo {
  id: string
  name: string
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-muted text-muted'
          }`}
        />
      ))}
    </div>
  )
}

export default function ClientReviewsPage({
  params,
}: {
  params: { clientId: string }
}) {
  const { clientId } = params
  const router = useRouter()
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [ratingFilter, setRatingFilter] = useState<string>('all')
  const [responseFilter, setResponseFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draftResponses, setDraftResponses] = useState<Record<string, string>>({})
  const [draftingAI, setDraftingAI] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [clientRes, reviewsQuery] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name')
          .eq('id', clientId)
          .single(),
        (() => {
          let query = supabase
            .from('reviews')
            .select('id, reviewer_name, reviewer_photo_url, star_rating, comment, response_status, response_body, reviewed_at, created_at')
            .eq('client_id', clientId)
            .order('reviewed_at', { ascending: false })

          if (ratingFilter !== 'all') {
            query = query.eq('star_rating', parseInt(ratingFilter))
          }
          if (responseFilter !== 'all') {
            query = query.eq('response_status', responseFilter)
          }

          return query
        })(),
      ])

      if (clientRes.data) setClient(clientRes.data)
      if (reviewsQuery.data) setReviews(reviewsQuery.data)

      setLoading(false)
    }

    fetchData()
  }, [clientId, ratingFilter, responseFilter])

  async function handleSyncReviews() {
    setSyncing(true)
    // In a real implementation, this would call an API to sync reviews from Google
    // For now, simulate a delay
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setSyncing(false)
    // Re-fetch reviews
    window.location.reload()
  }

  async function handleDraftAIResponse(reviewId: string) {
    setDraftingAI(reviewId)
    // In a real implementation, this would call an AI endpoint to draft a response
    // Simulate AI response generation
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const review = reviews.find((r) => r.id === reviewId)
    const draft = review && review.star_rating >= 4
      ? `Thank you so much for your wonderful ${review.star_rating}-star review, ${review.reviewer_name}! We really appreciate your kind words and are delighted you had a great experience. We look forward to welcoming you back soon!`
      : `Thank you for your feedback, ${review?.reviewer_name}. We're sorry to hear that your experience didn't meet expectations. We take all feedback seriously and would love the opportunity to make things right. Please don't hesitate to get in touch with us directly so we can address your concerns.`

    setDraftResponses((prev) => ({ ...prev, [reviewId]: draft }))
    setDraftingAI(null)
  }

  function toggleExpanded(reviewId: string) {
    setExpandedId((prev) => (prev === reviewId ? null : reviewId))
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
            <h1 className="text-3xl font-bold tracking-tight">Reviews</h1>
            <p className="text-muted-foreground">
              {client?.name || 'Loading...'} - Review Management
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleSyncReviews} disabled={syncing}>
          {syncing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync Reviews
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={ratingFilter} onValueChange={setRatingFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Star Rating" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ratings</SelectItem>
            <SelectItem value="5">5 Stars</SelectItem>
            <SelectItem value="4">4 Stars</SelectItem>
            <SelectItem value="3">3 Stars</SelectItem>
            <SelectItem value="2">2 Stars</SelectItem>
            <SelectItem value="1">1 Star</SelectItem>
          </SelectContent>
        </Select>
        <Select value={responseFilter} onValueChange={setResponseFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Response Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="drafted">Drafted</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="published">Published</SelectItem>
            <SelectItem value="skipped">Skipped</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reviews List */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No reviews found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Try syncing reviews or adjusting your filters.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const isExpanded = expandedId === review.id
            const hasDraft = !!draftResponses[review.id]

            return (
              <Card key={review.id}>
                <CardContent className="pt-4">
                  {/* Review Header */}
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => toggleExpanded(review.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                        <span className="text-sm font-medium">
                          {review.reviewer_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {review.reviewer_name}
                          </span>
                          <StarRating rating={review.star_rating} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(review.reviewed_at, 'dd MMM yyyy')} ({formatTimeAgo(review.reviewed_at)})
                        </p>
                        {!isExpanded && review.comment && (
                          <p className="text-sm text-muted-foreground mt-2">
                            {truncateText(review.comment, 120)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={review.response_status} />
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      {/* Full Review Comment */}
                      {review.comment && (
                        <div>
                          <p className="text-sm font-medium mb-1">Review</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {review.comment}
                          </p>
                        </div>
                      )}

                      {/* Existing Response */}
                      {review.response_body && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <p className="text-sm font-medium mb-1">Current Response</p>
                          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                            {review.response_body}
                          </p>
                        </div>
                      )}

                      {/* Draft Response Editor */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">Draft Response</p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDraftAIResponse(review.id)}
                            disabled={draftingAI === review.id}
                          >
                            {draftingAI === review.id ? (
                              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="mr-2 h-3.5 w-3.5" />
                            )}
                            Draft AI Response
                          </Button>
                        </div>
                        <Textarea
                          rows={4}
                          placeholder="Write a response to this review..."
                          value={draftResponses[review.id] || ''}
                          onChange={(e) =>
                            setDraftResponses((prev) => ({
                              ...prev,
                              [review.id]: e.target.value,
                            }))
                          }
                        />
                        {hasDraft && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setDraftResponses((prev) => {
                                  const next = { ...prev }
                                  delete next[review.id]
                                  return next
                                })
                              }
                            >
                              Discard
                            </Button>
                            <Button size="sm">Save Draft</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
