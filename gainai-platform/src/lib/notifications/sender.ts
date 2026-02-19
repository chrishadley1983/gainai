import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateNotificationParams {
  recipientType: 'USER' | 'TEAM' | 'ORGANISATION'
  recipientId: string
  title: string
  body: string
  link?: string
  type: string
}

export interface NotificationRecord {
  id: string
  recipient_type: string
  recipient_id: string
  title: string
  body: string
  link: string | null
  type: string
  read: boolean
  created_at: string
}

// ---------------------------------------------------------------------------
// createNotification – create a single notification
// ---------------------------------------------------------------------------

/**
 * Create a notification record in the database.
 *
 * @param params - The notification details.
 * @returns The created notification record, or null on failure.
 */
export async function createNotification(
  params: CreateNotificationParams
): Promise<NotificationRecord | null> {
  const supabase = createAdminClient()

  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        recipient_type: params.recipientType,
        recipient_id: params.recipientId,
        title: params.title,
        body: params.body,
        link: params.link ?? null,
        type: params.type,
        read: false,
      })
      .select()
      .single()

    if (error) {
      throw new Error(error.message)
    }

    console.log(
      `[notifications/sender] Created notification for ${params.recipientType}:${params.recipientId}`
    )
    return data as NotificationRecord
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create notification'
    console.error('[notifications/sender] createNotification error:', message)
    return null
  }
}

// ---------------------------------------------------------------------------
// sendNotificationBatch – create multiple notifications at once
// ---------------------------------------------------------------------------

/**
 * Create multiple notification records in a single batch insert.
 *
 * @param notifications - Array of notification parameters.
 * @returns An object with the count of successfully created and failed notifications.
 */
export async function sendNotificationBatch(
  notifications: CreateNotificationParams[]
): Promise<{ successCount: number; errorCount: number }> {
  if (notifications.length === 0) {
    return { successCount: 0, errorCount: 0 }
  }

  const supabase = createAdminClient()

  try {
    const rows = notifications.map((n) => ({
      recipient_type: n.recipientType,
      recipient_id: n.recipientId,
      title: n.title,
      body: n.body,
      link: n.link ?? null,
      type: n.type,
      read: false,
    }))

    const { data, error } = await supabase
      .from('notifications')
      .insert(rows)
      .select('id')

    if (error) {
      throw new Error(error.message)
    }

    const successCount = data?.length ?? 0
    const errorCount = notifications.length - successCount

    console.log(
      `[notifications/sender] Batch created ${successCount} notifications (${errorCount} failed)`
    )

    return { successCount, errorCount }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Batch notification insert failed'
    console.error('[notifications/sender] sendNotificationBatch error:', message)
    return { successCount: 0, errorCount: notifications.length }
  }
}
