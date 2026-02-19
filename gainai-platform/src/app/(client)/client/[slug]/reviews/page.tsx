'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  MessageSquare,
  Check,
  Pencil,
  SkipForward,
  Filter,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { StarRating } from '@/components/shared/StarRating'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { FilterBar } from '@/components/shared/FilterBar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatTimeAgo } from '@/lib/utils/dates'
import { truncateText } from '@/lib/utils/formatting'

interface ReviewItem {
  id: string
  reviewer_name: string
  reviewer_photo_url: string | null
  star_rating: number
  comment: string | null
  reviewed_at: string
  response_status: string
  ai_draft_response: string | null
  published_response: string | null
}

export default function ReviewsPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({
    rating: '',
    status: '',
  })

  // Inline edit states
  const [editingDraft, setEditingDraft] = useState<Record<string, string>>({})
  const [showEdit, setShowEdit] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})

  const filters = [
    {
      key: 'rating',
      label: 'Star Rating',
      options: [
        { label: '5 Stars', value: '5' },
        { label: '4 Stars', value: '4' },
        { label: '3 Stars', value: '3' },
        { label: '2 Stars', value: '2' },
        { label: '1 Star', value: '1' },
      ],
    },
    {
      key: 'status',
      label: 'Response Status',
      options: [
        { label: 'Pending Approval', value: 'pending_approval' },
        { label: 'Approved', value: 'approved' },
        { label: 'Published', value: 'published' },
        { label: 'Skipped', value: 'skipped' },
        { label: 'No Response', value: 'no_response' },
      ],
    },
  ]

  useEffect(() => {
    async function loadReviews() {
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

      let query = supabase
        .from('reviews')
        .select(
          'id, reviewer_name, reviewer_photo_url, star_rating, comment, reviewed_at, response_status, ai_draft_response, published_response'
        )
        .eq('client_id', client.id)
        .order('reviewed_at', { ascending: false })

      if (activeFilters.rating) {
        query = query.eq('star_rating', parseInt(activeFilters.rating))
      }

      if (activeFilters.status) {
        query = query.eq('response_status', activeFilters.status)
      }

      const { data } = await query.limit(50)

      setReviews(data || [])
      setLoading(false)
    }

    loadReviews()
  }, [slug, activeFilters, supabase])

  async function handleApprove(reviewId: string) {
    setSubmitting((prev) => ({ ...prev, [reviewId]: true }))

    await supabase
      .from('reviews')
      .update({ response_status: 'approved' })
      .eq('id', reviewId)

    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId ? { ...r, response_status: 'approved' } : r
      )
    )
    setSubmitting((prev) => ({ ...prev, [reviewId]: false }))
  }

  async function handleEditAndApprove(reviewId: string) {
    const editedText = editingDraft[reviewId]
    if (!editedText?.trim()) return

    setSubmitting((prev) => ({ ...prev, [reviewId]: true }))

    await supabase
      .from('reviews')
      .update({
        response_status: 'approved',
        ai_draft_response: editedText.trim(),
      })
      .eq('id', reviewId)

    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, response_status: 'approved', ai_draft_response: editedText.trim() }
          : r
      )
    )
    setShowEdit((prev) => ({ ...prev, [reviewId]: false }))
    setSubmitting((prev) => ({ ...prev, [reviewId]: false }))
  }

  async function handleSkip(reviewId: string) {
    setSubmitting((prev) => ({ ...prev, [reviewId]: true }))

    await supabase
      .from('reviews')
      .update({ response_status: 'skipped' })
      .eq('id', reviewId)

    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId ? { ...r, response_status: 'skipped' } : r
      )
    )
    setSubmitting((prev) => ({ ...prev, [reviewId]: false }))
  }

  function toggleEdit(reviewId: string) {
    const review = reviews.find((r) => r.id === reviewId)
    if (review && !editingDraft[reviewId]) {
      setEditingDraft((prev) => ({
        ...prev,
        [reviewId]: review.ai_draft_response || '',
      }))
    }
    setShowEdit((prev) => ({ ...prev, [reviewId]: !prev[reviewId] }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="text-muted-foreground">
          Manage and respond to your Google Business Profile reviews
        </p>
      </div>

      <FilterBar
        filters={filters}
        activeFilters={activeFilters}
        onChange={setActiveFilters}
      />

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No reviews found"
          description="No reviews match your current filters."
        />
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => {
            const isPendingApproval = review.response_status === 'pending_approval'

            return (
              <Card key={review.id}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Reviewer avatar */}
                    <div className="shrink-0">
                      {review.reviewer_photo_url ? (
                        <img
                          src={review.reviewer_photo_url}
                          alt={review.reviewer_name}
                          className="h-10 w-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                          <span className="text-xs font-medium">
                            {review.reviewer_name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <Link
                            href={`/client/${slug}/reviews/${review.id}`}
                            className="font-medium hover:underline"
                          >
                            {review.reviewer_name}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            <StarRating rating={review.star_rating} size="sm" />
                            <span className="text-xs text-muted-foreground">
                              {formatTimeAgo(review.reviewed_at)}
                            </span>
                          </div>
                        </div>
                        <StatusBadge status={review.response_status.replace(/_/g, ' ')} />
                      </div>

                      {review.comment && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          {review.comment}
                        </p>
                      )}

                      {/* AI draft response with pending approval actions */}
                      {isPendingApproval && review.ai_draft_response && (
                        <div className="mt-3 space-y-3">
                          <div className="rounded-md bg-muted/50 p-3 border-l-2 border-primary/30">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              AI-Drafted Response
                            </p>
                            {showEdit[review.id] ? (
                              <Textarea
                                value={editingDraft[review.id] || ''}
                                onChange={(e) =>
                                  setEditingDraft((prev) => ({
                                    ...prev,
                                    [review.id]: e.target.value,
                                  }))
                                }
                                className="mt-2"
                                rows={4}
                              />
                            ) : (
                              <p className="text-sm">{review.ai_draft_response}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {showEdit[review.id] ? (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleEditAndApprove(review.id)}
                                  disabled={submitting[review.id]}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  Save & Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => toggleEdit(review.id)}
                                >
                                  Cancel
                                </Button>
                              </>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                  onClick={() => handleApprove(review.id)}
                                  disabled={submitting[review.id]}
                                >
                                  <Check className="h-3.5 w-3.5 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleEdit(review.id)}
                                >
                                  <Pencil className="h-3.5 w-3.5 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-muted-foreground"
                                  onClick={() => handleSkip(review.id)}
                                  disabled={submitting[review.id]}
                                >
                                  <SkipForward className="h-3.5 w-3.5 mr-1" />
                                  Skip
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Published response display */}
                      {review.published_response && (
                        <div className="mt-3 rounded-md bg-emerald-50 p-3 border-l-2 border-emerald-300">
                          <p className="text-xs font-medium text-emerald-700 mb-1">
                            Published Response
                          </p>
                          <p className="text-sm text-emerald-800">
                            {review.published_response}
                          </p>
                        </div>
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
