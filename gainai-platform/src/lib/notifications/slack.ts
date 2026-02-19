// ---------------------------------------------------------------------------
// Slack webhook integration
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlackSeverity = 'info' | 'warning' | 'error' | 'critical'

export interface SlackMessageResult {
  success: boolean
  error?: string
}

interface SlackBlock {
  type: string
  text?: {
    type: string
    text: string
    emoji?: boolean
  }
  elements?: Array<{
    type: string
    text: string
    emoji?: boolean
  }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWebhookUrl(channel?: string): string {
  // Support multiple webhook URLs for different channels
  if (channel) {
    const channelEnvKey = `SLACK_WEBHOOK_URL_${channel.toUpperCase().replace(/-/g, '_')}`
    const channelUrl = process.env[channelEnvKey]
    if (channelUrl) {
      return channelUrl
    }
  }

  const defaultUrl = process.env.SLACK_WEBHOOK_URL
  if (!defaultUrl) {
    throw new Error(
      'SLACK_WEBHOOK_URL is not set. Add it to your environment variables.'
    )
  }

  return defaultUrl
}

function getSeverityEmoji(severity: SlackSeverity): string {
  switch (severity) {
    case 'info':
      return 'information_source'
    case 'warning':
      return 'warning'
    case 'error':
      return 'x'
    case 'critical':
      return 'rotating_light'
  }
}

function getSeverityColor(severity: SlackSeverity): string {
  switch (severity) {
    case 'info':
      return '#2196F3'
    case 'warning':
      return '#FF9800'
    case 'error':
      return '#F44336'
    case 'critical':
      return '#B71C1C'
  }
}

// ---------------------------------------------------------------------------
// sendSlackMessage – send a simple text message
// ---------------------------------------------------------------------------

/**
 * Send a plain text message to a Slack channel via webhook.
 *
 * @param message - The message text (supports Slack markdown).
 * @param channel - Optional channel identifier for webhook URL lookup.
 */
export async function sendSlackMessage(
  message: string,
  channel?: string
): Promise<SlackMessageResult> {
  try {
    const webhookUrl = getWebhookUrl(channel)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Slack webhook returned ${response.status}: ${body}`)
    }

    console.log('[notifications/slack] Message sent successfully')
    return { success: true }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown Slack error'
    console.error('[notifications/slack] sendSlackMessage error:', errorMessage)
    return { success: false, error: errorMessage }
  }
}

// ---------------------------------------------------------------------------
// sendSlackAlert – send a structured alert with severity
// ---------------------------------------------------------------------------

/**
 * Send a structured alert message to Slack with title, text, and severity
 * indicator. Uses Slack Block Kit for rich formatting.
 *
 * @param title - The alert title.
 * @param text - The alert body text.
 * @param severity - The severity level.
 * @param channel - Optional channel identifier.
 */
export async function sendSlackAlert(
  title: string,
  text: string,
  severity: SlackSeverity,
  channel?: string
): Promise<SlackMessageResult> {
  try {
    const webhookUrl = getWebhookUrl(channel)
    const emoji = getSeverityEmoji(severity)
    const color = getSeverityColor(severity)

    const blocks: SlackBlock[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `:${emoji}: ${title}`,
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `*Severity:* ${severity.toUpperCase()} | *Time:* ${new Date().toISOString()}`,
          },
        ],
      },
    ]

    const payload = {
      text: `[${severity.toUpperCase()}] ${title}: ${text}`,
      blocks,
      attachments: [
        {
          color,
          blocks: [],
        },
      ],
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Slack webhook returned ${response.status}: ${body}`)
    }

    console.log(
      `[notifications/slack] Alert sent: [${severity}] ${title}`
    )
    return { success: true }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unknown Slack error'
    console.error('[notifications/slack] sendSlackAlert error:', errorMessage)
    return { success: false, error: errorMessage }
  }
}
