'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  Pencil,
  SkipForward,
  Calendar,
  User,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StarRating } from '@/components/shared/StarRating'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils/dates'

interface ReviewDetail {
  id: string
  reviewer_name: string
  reviewer_photo_url: string | null
  star_rating: number
  comment: string | null
  reviewed_at: string
  response_status: string
  ai_draft_response: string | null
  published_response: string | null
  responded_at: string | null
}

export default function ReviewDetailPage({
  params,
}: {
  params: { slug: string; reviewId: string }
}) {
  const { slug, reviewId } = params
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [review, setReview] = useState<ReviewDetail | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editedResponse, setEditedResponse] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    async function loadReview() {
      setLoading(true)

      const { data } = await supabase
        .from('reviews')
        .select(
          'id, reviewer_name, reviewer_photo_url, star_rating, comment, reviewed_at, response_status, ai_draft_response, published_response, responded_at'
        )
        .eq('id', reviewId)
        .single()

      if (data) {
        setReview(data)
        setEditedResponse(data.ai_draft_response || '')
      }
      setLoading(false)
    }

    loadReview()
  }, [reviewId, supabase])

  async function handleApproveAsIs() {
    if (!review) return
    setSubmitting(true)

    await supabase
      .from('reviews')
      .update({ response_status: 'approved' })
      .eq('id', review.id)

    setReview((prev) => (prev ? { ...prev, response_status: 'approved' } : prev))
    setSubmitting(false)
  }

  async function handleEditAndApprove() {
    if (!review || !editedResponse.trim()) return
    setSubmitting(true)

    await supabase
      .from('reviews')
      .update({
        response_status: 'approved',
        ai_draft_response: editedResponse.trim(),
      })
      .eq('id', review.id)

    setReview((prev) =>
      prev
        ? {
            ...prev,
            response_status: 'approved',
            ai_draft_response: editedResponse.trim(),
          }
        : prev
    )
    setIsEditing(false)
    setSubmitting(false)
  }

  async function handleSkip() {
    if (!review) return
    setSubmitting(true)

    await supabase
      .from('reviews')
      .update({ response_status: 'skipped' })
      .eq('id', review.id)

    setReview((prev) => (prev ? { ...prev, response_status: 'skipped' } : prev))
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  if (!review) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/client/${slug}/reviews`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Review not found</h1>
        </div>
      </div>
    )
  }

  const isPendingApproval = review.response_status === 'pending_approval'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/client/${slug}/reviews`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Detail</h1>
          <p className="text-muted-foreground">
            from {review.reviewer_name}
          </p>
        </div>
      </div>

      {/* Full review display */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            {review.reviewer_photo_url ? (
              <img
                src={review.reviewer_photo_url}
                alt={review.reviewer_name}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-lg font-semibold">{review.reviewer_name}</p>
              <div className="flex items-center gap-3 mt-1">
                <StarRating rating={review.star_rating} size="md" showValue />
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDate(review.reviewed_at, 'dd MMM yyyy')}
                </div>
              </div>
            </div>
            <StatusBadge status={review.response_status.replace(/_/g, ' ')} />
          </div>

          {review.comment ? (
            <div className="rounded-lg bg-muted/30 p-4">
              <p className="text-sm leading-relaxed">{review.comment}</p>
            </div>
          ) : (
            <p className="text-sm italic text-muted-foreground">
              No written comment provided.
            </p>
          )}
        </CardContent>
      </Card>

      {/* AI-drafted response */}
      {(review.ai_draft_response || review.published_response) && (
        <Card>
          <CardHeader>
            <CardTitle>
              {review.published_response
                ? 'Published Response'
                : 'AI-Drafted Response'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {review.published_response ? (
              <div className="rounded-lg bg-emerald-50 p-4 border-l-4 border-emerald-400">
                <p className="text-sm leading-relaxed text-emerald-800">
                  {review.published_response}
                </p>
                {review.responded_at && (
                  <p className="mt-2 text-xs text-emerald-600">
                    Published on {formatDate(review.responded_at, 'dd MMM yyyy HH:mm')}
                  </p>
                )}
              </div>
            ) : isEditing ? (
              <div className="space-y-3">
                <Textarea
                  value={editedResponse}
                  onChange={(e) => setEditedResponse(e.target.value)}
                  rows={6}
                  placeholder="Edit the response..."
                />
                <div className="flex items-center gap-2">
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleEditAndApprove}
                    disabled={!editedResponse.trim() || submitting}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Save & Approve
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setIsEditing(false)
                      setEditedResponse(review.ai_draft_response || '')
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-muted/30 p-4 border-l-4 border-primary/30">
                  <p className="text-sm leading-relaxed">
                    {review.ai_draft_response}
                  </p>
                </div>

                {isPendingApproval && (
                  <div className="flex items-center gap-2">
                    <Button
                      className="bg-emerald-600 hover:bg-emerald-700"
                      onClick={handleApproveAsIs}
                      disabled={submitting}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      Approve as-is
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Edit then approve
                    </Button>
                    <Button
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={handleSkip}
                      disabled={submitting}
                    >
                      <SkipForward className="h-4 w-4 mr-1" />
                      Skip
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No response yet */}
      {!review.ai_draft_response && !review.published_response && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No response has been drafted for this review yet.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
