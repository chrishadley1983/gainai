'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PerformanceDailyRow {
  id: string
  location_id: string
  client_id: string
  date: string
  search_impressions: number | null
  map_impressions: number | null
  website_clicks: number | null
  phone_clicks: number | null
  direction_requests: number | null
  booking_clicks: number | null
  photo_views: number | null
  total_reviews: number | null
  average_rating: number | null
  created_at: string
}

export interface SearchKeywordRow {
  id: string
  location_id: string
  keyword: string
  impressions: number
  period_start: string
  period_end: string
  created_at: string
}

export interface DateRange {
  from: Date
  to: Date
}

// ---------------------------------------------------------------------------
// usePerformanceDaily – fetch daily performance metrics for a location
// ---------------------------------------------------------------------------

export function usePerformanceDaily(
  locationId: string | undefined,
  dateRange: DateRange | undefined
) {
  const [metrics, setMetrics] = useState<PerformanceDailyRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    if (!locationId || !dateRange) {
      setMetrics([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: queryError } = await supabase
        .from('performance_daily')
        .select('*')
        .eq('location_id', locationId)
        .gte('date', dateRange.from.toISOString().split('T')[0])
        .lte('date', dateRange.to.toISOString().split('T')[0])
        .order('date', { ascending: true })

      if (queryError) {
        throw new Error(queryError.message)
      }

      setMetrics((data as PerformanceDailyRow[]) ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch performance metrics'
      setError(message)
      console.error('[usePerformanceDaily]', message)
    } finally {
      setLoading(false)
    }
  }, [locationId, dateRange?.from?.toISOString(), dateRange?.to?.toISOString()])

  useEffect(() => {
    fetchMetrics()
  }, [fetchMetrics])

  return { metrics, loading, error, refetch: fetchMetrics }
}

// ---------------------------------------------------------------------------
// useSearchKeywords – fetch search keywords for a location
// ---------------------------------------------------------------------------

export function useSearchKeywords(locationId: string | undefined) {
  const [keywords, setKeywords] = useState<SearchKeywordRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchKeywords = useCallback(async () => {
    if (!locationId) {
      setKeywords([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: queryError } = await supabase
        .from('search_keywords')
        .select('*')
        .eq('location_id', locationId)
        .order('impressions', { ascending: false })

      if (queryError) {
        throw new Error(queryError.message)
      }

      setKeywords((data as SearchKeywordRow[]) ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch search keywords'
      setError(message)
      console.error('[useSearchKeywords]', message)
    } finally {
      setLoading(false)
    }
  }, [locationId])

  useEffect(() => {
    fetchKeywords()
  }, [fetchKeywords])

  return { keywords, loading, error, refetch: fetchKeywords }
}
