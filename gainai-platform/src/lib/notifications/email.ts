import { Resend } from 'resend'

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let resendInstance: Resend | null = null

function getResendClient(): Resend {
  if (resendInstance) {
    return resendInstance
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error(
      'RESEND_API_KEY is not set. Add it to your environment variables.'
    )
  }

  resendInstance = new Resend(apiKey)
  return resendInstance
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? 'GainAI <noreply@gainai.com>'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendEmailResult {
  success: boolean
  messageId?: string
  error?: string
}

// ---------------------------------------------------------------------------
// sendEmail – generic email sending
// ---------------------------------------------------------------------------

/**
 * Send an email via Resend.
 *
 * @param to - Recipient email address (or array of addresses).
 * @param subject - Email subject line.
 * @param html - Email body as HTML.
 */
export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string
): Promise<SendEmailResult> {
  try {
    const resend = getResendClient()

    const { data, error } = await resend.emails.send({
      from: FROM_ADDRESS,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    })

    if (error) {
      console.error('[notifications/email] Resend error:', error.message)
      return { success: false, error: error.message }
    }

    console.log(
      `[notifications/email] Email sent to ${Array.isArray(to) ? to.join(', ') : to}, ID: ${data?.id}`
    )

    return { success: true, messageId: data?.id }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown email sending error'
    console.error('[notifications/email] sendEmail error:', message)
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// sendMagicLinkEmail – send a magic link login email
// ---------------------------------------------------------------------------

/**
 * Send a magic link email to a client portal user.
 *
 * @param to - Recipient email address.
 * @param link - The magic link URL.
 * @param clientName - The client's business name for personalisation.
 */
export async function sendMagicLinkEmail(
  to: string,
  link: string,
  clientName: string
): Promise<SendEmailResult> {
  const subject = `Your ${clientName} Portal Login Link`

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Welcome to the ${escapeHtml(clientName)} Portal</h2>
      <p>Click the button below to securely sign in to your dashboard:</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${escapeHtml(link)}"
           style="background-color: #6366f1; color: white; padding: 12px 24px;
                  border-radius: 6px; text-decoration: none; font-weight: 600;">
          Sign In
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">
        This link expires in 1 hour. If you didn't request this, you can safely ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px;">Powered by GainAI</p>
    </div>
  `

  return sendEmail(to, subject, html)
}

// ---------------------------------------------------------------------------
// sendReportReadyEmail – notify that a report is ready
// ---------------------------------------------------------------------------

/**
 * Send a notification that a performance report is ready to view.
 *
 * @param to - Recipient email address.
 * @param reportUrl - URL to view the report.
 * @param clientName - The client's business name.
 */
export async function sendReportReadyEmail(
  to: string,
  reportUrl: string,
  clientName: string
): Promise<SendEmailResult> {
  const subject = `Your ${clientName} Performance Report is Ready`

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Performance Report Ready</h2>
      <p>Great news! The latest performance report for <strong>${escapeHtml(clientName)}</strong> is now available.</p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${escapeHtml(reportUrl)}"
           style="background-color: #6366f1; color: white; padding: 12px 24px;
                  border-radius: 6px; text-decoration: none; font-weight: 600;">
          View Report
        </a>
      </div>
      <p style="color: #666; font-size: 14px;">
        This report includes insights on search visibility, customer actions,
        reviews, and posting activity.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #999; font-size: 12px;">Powered by GainAI</p>
    </div>
  `

  return sendEmail(to, subject, html)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
