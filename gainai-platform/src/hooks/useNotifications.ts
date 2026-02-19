'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NotificationRow {
  id: string
  recipient_type: 'USER' | 'TEAM' | 'ORGANISATION'
  recipient_id: string
  title: string
  body: string
  link: string | null
  type: string
  read: boolean
  read_at: string | null
  created_at: string
}

// ---------------------------------------------------------------------------
// useNotifications – fetch notifications for the current user
// ---------------------------------------------------------------------------

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      // Get the current user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error(authError?.message ?? 'Not authenticated')
      }

      const { data, error: queryError } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (queryError) {
        throw new Error(queryError.message)
      }

      setNotifications((data as NotificationRow[]) ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch notifications'
      setError(message)
      console.error('[useNotifications]', message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  )

  return { notifications, loading, error, unreadCount, refetch: fetchNotifications }
}

// ---------------------------------------------------------------------------
// useMarkRead – mark a single notification as read
// ---------------------------------------------------------------------------

export function useMarkRead() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const markRead = useCallback(async (notificationId: string): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)

      if (updateError) {
        throw new Error(updateError.message)
      }

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark notification as read'
      setError(message)
      console.error('[useMarkRead]', message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return { markRead, loading, error }
}

// ---------------------------------------------------------------------------
// useMarkAllRead – mark all notifications as read for the current user
// ---------------------------------------------------------------------------

export function useMarkAllRead() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const markAllRead = useCallback(async (): Promise<boolean> => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        throw new Error(authError?.message ?? 'Not authenticated')
      }

      const { error: updateError } = await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('recipient_id', user.id)
        .eq('read', false)

      if (updateError) {
        throw new Error(updateError.message)
      }

      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark all notifications as read'
      setError(message)
      console.error('[useMarkAllRead]', message)
      return false
    } finally {
      setLoading(false)
    }
  }, [])

  return { markAllRead, loading, error }
}
