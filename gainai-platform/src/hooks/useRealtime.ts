'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RealtimeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*'

export interface RealtimeFilter {
  event?: RealtimeEvent
  schema?: string
  filter?: string // e.g. "client_id=eq.abc123"
}

export type RealtimeCallback<T extends Record<string, unknown> = Record<string, unknown>> = (
  payload: RealtimePostgresChangesPayload<T>
) => void

// ---------------------------------------------------------------------------
// useRealtimeSubscription – subscribe to Postgres changes on a table
// ---------------------------------------------------------------------------

export function useRealtimeSubscription<
  T extends Record<string, unknown> = Record<string, unknown>
>(
  table: string,
  callback: RealtimeCallback<T>,
  filter?: RealtimeFilter
) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channelName = `realtime:${table}:${filter?.filter ?? 'all'}`

    const channelConfig: {
      event: RealtimeEvent
      schema: string
      table: string
      filter?: string
    } = {
      event: filter?.event ?? '*',
      schema: filter?.schema ?? 'gainai',
      table,
    }

    if (filter?.filter) {
      channelConfig.filter = filter.filter
    }

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes' as never,
        channelConfig,
        (payload: RealtimePostgresChangesPayload<T>) => {
          callback(payload)
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.error(`[useRealtime] Channel error for table "${table}"`)
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [table, filter?.event, filter?.schema, filter?.filter, callback])

  return channelRef
}
