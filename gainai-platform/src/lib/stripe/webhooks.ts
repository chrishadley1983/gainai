import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookHandlerResult {
  success: boolean
  message: string
}

// ---------------------------------------------------------------------------
// handleInvoicePaymentSucceeded
// ---------------------------------------------------------------------------

/**
 * Handle Stripe `invoice.payment_succeeded` webhook event.
 *
 * Updates the client record to reflect a successful payment and records
 * the payment in the billing_events table.
 */
export async function handleInvoicePaymentSucceeded(
  event: Stripe.Event
): Promise<WebhookHandlerResult> {
  const invoice = event.data.object as Stripe.Invoice

  try {
    const supabase = createAdminClient()
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id

    if (!customerId) {
      return { success: false, message: 'No customer ID on invoice' }
    }

    // Find the client linked to this Stripe customer
    const { data: client, error: lookupError } = await supabase
      .from('clients')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()

    if (lookupError || !client) {
      return {
        success: false,
        message: `Client not found for Stripe customer ${customerId}`,
      }
    }

    // Record the billing event
    await supabase.from('billing_events').insert({
      client_id: client.id,
      stripe_event_id: event.id,
      type: 'PAYMENT_SUCCEEDED',
      amount_cents: invoice.amount_paid,
      currency: invoice.currency,
      invoice_url: invoice.hosted_invoice_url,
      occurred_at: new Date(event.created * 1000).toISOString(),
    })

    // Ensure client status is ACTIVE after successful payment
    await supabase
      .from('clients')
      .update({
        status: 'ACTIVE',
        last_payment_at: new Date(event.created * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)

    console.log(
      `[stripe/webhooks] Payment succeeded for client ${client.id}, invoice ${invoice.id}`
    )
    return { success: true, message: 'Payment recorded successfully' }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error processing payment'
    console.error('[stripe/webhooks] handleInvoicePaymentSucceeded error:', message)
    return { success: false, message }
  }
}

// ---------------------------------------------------------------------------
// handleInvoicePaymentFailed
// ---------------------------------------------------------------------------

/**
 * Handle Stripe `invoice.payment_failed` webhook event.
 *
 * Records the failure and optionally flags the client for attention.
 */
export async function handleInvoicePaymentFailed(
  event: Stripe.Event
): Promise<WebhookHandlerResult> {
  const invoice = event.data.object as Stripe.Invoice

  try {
    const supabase = createAdminClient()
    const customerId =
      typeof invoice.customer === 'string'
        ? invoice.customer
        : invoice.customer?.id

    if (!customerId) {
      return { success: false, message: 'No customer ID on invoice' }
    }

    const { data: client, error: lookupError } = await supabase
      .from('clients')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()

    if (lookupError || !client) {
      return {
        success: false,
        message: `Client not found for Stripe customer ${customerId}`,
      }
    }

    // Record the billing event
    await supabase.from('billing_events').insert({
      client_id: client.id,
      stripe_event_id: event.id,
      type: 'PAYMENT_FAILED',
      amount_cents: invoice.amount_due,
      currency: invoice.currency,
      occurred_at: new Date(event.created * 1000).toISOString(),
    })

    console.log(
      `[stripe/webhooks] Payment failed for client ${client.id}, invoice ${invoice.id}`
    )
    return { success: true, message: 'Payment failure recorded' }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error processing payment failure'
    console.error('[stripe/webhooks] handleInvoicePaymentFailed error:', message)
    return { success: false, message }
  }
}

// ---------------------------------------------------------------------------
// handleSubscriptionDeleted
// ---------------------------------------------------------------------------

/**
 * Handle Stripe `customer.subscription.deleted` webhook event.
 *
 * Marks the client as CHURNED when their subscription is cancelled.
 */
export async function handleSubscriptionDeleted(
  event: Stripe.Event
): Promise<WebhookHandlerResult> {
  const subscription = event.data.object as Stripe.Subscription

  try {
    const supabase = createAdminClient()
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id

    if (!customerId) {
      return { success: false, message: 'No customer ID on subscription' }
    }

    const { data: client, error: lookupError } = await supabase
      .from('clients')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()

    if (lookupError || !client) {
      return {
        success: false,
        message: `Client not found for Stripe customer ${customerId}`,
      }
    }

    await supabase
      .from('clients')
      .update({
        status: 'CHURNED',
        stripe_subscription_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', client.id)

    // Record the billing event
    await supabase.from('billing_events').insert({
      client_id: client.id,
      stripe_event_id: event.id,
      type: 'SUBSCRIPTION_DELETED',
      occurred_at: new Date(event.created * 1000).toISOString(),
    })

    console.log(
      `[stripe/webhooks] Subscription deleted for client ${client.id}`
    )
    return { success: true, message: 'Subscription deletion recorded' }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error processing subscription deletion'
    console.error('[stripe/webhooks] handleSubscriptionDeleted error:', message)
    return { success: false, message }
  }
}

// ---------------------------------------------------------------------------
// handleSubscriptionUpdated
// ---------------------------------------------------------------------------

/**
 * Handle Stripe `customer.subscription.updated` webhook event.
 *
 * Syncs subscription status changes (e.g. plan upgrades/downgrades, pauses).
 */
export async function handleSubscriptionUpdated(
  event: Stripe.Event
): Promise<WebhookHandlerResult> {
  const subscription = event.data.object as Stripe.Subscription

  try {
    const supabase = createAdminClient()
    const customerId =
      typeof subscription.customer === 'string'
        ? subscription.customer
        : subscription.customer?.id

    if (!customerId) {
      return { success: false, message: 'No customer ID on subscription' }
    }

    const { data: client, error: lookupError } = await supabase
      .from('clients')
      .select('id')
      .eq('stripe_customer_id', customerId)
      .single()

    if (lookupError || !client) {
      return {
        success: false,
        message: `Client not found for Stripe customer ${customerId}`,
      }
    }

    // Determine client status from subscription status
    let clientStatus: string | undefined
    switch (subscription.status) {
      case 'active':
      case 'trialing':
        clientStatus = 'ACTIVE'
        break
      case 'past_due':
      case 'unpaid':
        // Keep active but flag for attention
        clientStatus = undefined
        break
      case 'paused':
        clientStatus = 'PAUSED'
        break
      case 'canceled':
        clientStatus = 'CHURNED'
        break
    }

    const updatePayload: Record<string, unknown> = {
      stripe_subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    }

    if (clientStatus) {
      updatePayload.status = clientStatus
    }

    await supabase
      .from('clients')
      .update(updatePayload)
      .eq('id', client.id)

    // Record the billing event
    await supabase.from('billing_events').insert({
      client_id: client.id,
      stripe_event_id: event.id,
      type: 'SUBSCRIPTION_UPDATED',
      metadata: { status: subscription.status },
      occurred_at: new Date(event.created * 1000).toISOString(),
    })

    console.log(
      `[stripe/webhooks] Subscription updated for client ${client.id}, status: ${subscription.status}`
    )
    return { success: true, message: 'Subscription update recorded' }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Unknown error processing subscription update'
    console.error('[stripe/webhooks] handleSubscriptionUpdated error:', message)
    return { success: false, message }
  }
}
