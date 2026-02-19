import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Google sends notification payloads with a resourceId and channelId
    // that were registered via the Google Business Profile API watch endpoint
    const {
      channelId,
      resourceId,
      resourceState,
      resourceUri,
    } = body

    if (!channelId || !resourceState) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: 'Missing required notification fields' } },
        { status: 400 }
      )
    }

    // Acknowledge sync notifications (initial handshake)
    if (resourceState === 'sync') {
      return NextResponse.json(
        { success: true, data: { acknowledged: true } },
        { status: 200 }
      )
    }

    const supabase = createAdminClient()

    // Look up the webhook channel registration to identify the location
    const { data: channel } = await supabase
      .from('webhook_channels')
      .select('id, location_id, client_id, channel_type')
      .eq('channel_id', channelId)
      .eq('is_active', true)
      .single()

    if (!channel) {
      console.warn(`Google webhook received for unknown channel: ${channelId}`)
      // Still return 200 to prevent Google from retrying
      return NextResponse.json(
        { success: true, data: { acknowledged: true, matched: false } },
        { status: 200 }
      )
    }

    // Process based on the channel type / notification content
    switch (channel.channel_type) {
      case 'reviews': {
        // A review was added or updated for this location
        // Queue a sync job rather than processing inline
        await supabase.from('sync_queue').insert({
          location_id: channel.location_id,
          client_id: channel.client_id,
          sync_type: 'reviews',
          status: 'pending',
          triggered_by: 'google_webhook',
          metadata: {
            channel_id: channelId,
            resource_id: resourceId,
            resource_uri: resourceUri,
          },
        })

        // Log activity
        await supabase.from('activity_log').insert({
          client_id: channel.client_id,
          location_id: channel.location_id,
          actor_type: 'system',
          action: 'review_notification_received',
          description: 'Google sent a review update notification - sync queued',
          metadata: {
            channel_id: channelId,
            resource_state: resourceState,
          },
        })
        break
      }

      case 'locations': {
        // Location data was updated (e.g. hours, attributes, info changes)
        await supabase.from('sync_queue').insert({
          location_id: channel.location_id,
          client_id: channel.client_id,
          sync_type: 'location',
          status: 'pending',
          triggered_by: 'google_webhook',
          metadata: {
            channel_id: channelId,
            resource_id: resourceId,
            resource_uri: resourceUri,
          },
        })

        // Log activity
        await supabase.from('activity_log').insert({
          client_id: channel.client_id,
          location_id: channel.location_id,
          actor_type: 'system',
          action: 'location_notification_received',
          description: 'Google sent a location update notification - sync queued',
          metadata: {
            channel_id: channelId,
            resource_state: resourceState,
          },
        })
        break
      }

      default: {
        // Unknown channel type - log and acknowledge
        console.log(`Google webhook received for unhandled channel type: ${channel.channel_type}`)

        await supabase.from('activity_log').insert({
          client_id: channel.client_id,
          location_id: channel.location_id,
          actor_type: 'system',
          action: 'google_notification_received',
          description: `Unhandled Google notification for channel type: ${channel.channel_type}`,
          metadata: {
            channel_id: channelId,
            channel_type: channel.channel_type,
            resource_state: resourceState,
            resource_id: resourceId,
          },
        })
      }
    }

    return NextResponse.json(
      { success: true, data: { acknowledged: true, matched: true } },
      { status: 200 }
    )
  } catch (error) {
    console.error('Google webhook error:', error)
    // Return 200 even on error to prevent Google from retrying endlessly
    return NextResponse.json(
      { success: true, data: { acknowledged: true, error: true } },
      { status: 200 }
    )
  }
}
