'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ReviewResponseStatus } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReviewRow {
  id: string
  location_id: string
  client_id: string
  google_review_id: string
  reviewer_name: string
  reviewer_photo_url: string | null
  star_rating: number
  comment: string | null
  reviewed_at: string
  response_status: ReviewResponseStatus
  ai_draft_response: string | null
  final_response: string | null
  responded_at: string | null
  created_at: string
  updated_at: string
}

export interface ReviewFilters {
  clientId?: string
  locationId?: string
  responseStatus?: ReviewResponseStatus
  starRating?: number
}

export interface UpdateReviewInput {
  response_status?: ReviewResponseStatus
  ai_draft_response?: string | null
  final_response?: string | null
  responded_at?: string | null
}

// ---------------------------------------------------------------------------
// useReviews – fetch reviews with optional filters
// ---------------------------------------------------------------------------

export function useReviews(filters?: ReviewFilters) {
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      let query = supabase
        .from('reviews')
        .select('*')
        .order('reviewed_at', { ascending: false })

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId)
      }

      if (filters?.locationId) {
        query = query.eq('location_id', filters.locationId)
      }

      if (filters?.responseStatus) {
        query = query.eq('response_status', filters.responseStatus)
      }

      if (filters?.starRating !== undefined) {
        query = query.eq('star_rating', filters.starRating)
      }

      const { data, error: queryError } = await query

      if (queryError) {
        throw new Error(queryError.message)
      }

      setReviews((data as ReviewRow[]) ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch reviews'
      setError(message)
      console.error('[useReviews]', message)
    } finally {
      setLoading(false)
    }
  }, [filters?.clientId, filters?.locationId, filters?.responseStatus, filters?.starRating])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  return { reviews, loading, error, refetch: fetchReviews }
}

// ---------------------------------------------------------------------------
// useReview – fetch a single review by ID
// ---------------------------------------------------------------------------

export function useReview(reviewId: string | undefined) {
  const [review, setReview] = useState<ReviewRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchReview = useCallback(async () => {
    if (!reviewId) {
      setReview(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: queryError } = await supabase
        .from('reviews')
        .select('*')
        .eq('id', reviewId)
        .single()

      if (queryError) {
        throw new Error(queryError.message)
      }

      setReview(data as ReviewRow)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch review'
      setError(message)
      console.error('[useReview]', message)
    } finally {
      setLoading(false)
    }
  }, [reviewId])

  useEffect(() => {
    fetchReview()
  }, [fetchReview])

  return { review, loading, error, refetch: fetchReview }
}

// ---------------------------------------------------------------------------
// useUpdateReview – mutation to update a review (response approval, etc.)
// ---------------------------------------------------------------------------

export function useUpdateReview() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateReview = useCallback(async (
    reviewId: string,
    input: UpdateReviewInput
  ): Promise<ReviewRow | null> => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: updateError } = await supabase
        .from('reviews')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', reviewId)
        .select()
        .single()

      if (updateError) {
        throw new Error(updateError.message)
      }

      return data as ReviewRow
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update review'
      setError(message)
      console.error('[useUpdateReview]', message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { updateReview, loading, error }
}
