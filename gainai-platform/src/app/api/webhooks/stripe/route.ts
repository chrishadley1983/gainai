import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createAdminClient } from '@/lib/supabase/admin'

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-01-28.clover',
  })
}

function getWebhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET!
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { success: false, error: { code: 'MISSING_SIGNATURE', message: 'Missing Stripe signature header' } },
        { status: 400 }
      )
    }

    let event: Stripe.Event

    try {
      event = getStripe().webhooks.constructEvent(body, signature, getWebhookSecret())
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid signature'
      console.error('Stripe webhook signature verification failed:', message)
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_SIGNATURE', message: 'Invalid webhook signature' } },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id

        if (!customerId) break

        // Find client by Stripe customer ID
        const { data: client } = await supabase
          .from('clients')
          .select('id, name')
          .eq('stripe_customer_id', customerId)
          .single()

        if (client) {
          // Update billing status
          await supabase
            .from('clients')
            .update({
              billing_status: 'active',
              last_payment_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', client.id)

          // Log activity
          await supabase.from('activity_log').insert({
            client_id: client.id,
            actor_type: 'system',
            action: 'payment_succeeded',
            description: `Payment of ${(invoice.amount_paid / 100).toFixed(2)} ${(invoice.currency || 'gbp').toUpperCase()} received for ${client.name}`,
            metadata: {
              invoice_id: invoice.id,
              amount: invoice.amount_paid,
              currency: invoice.currency,
            },
          })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const customerId = typeof invoice.customer === 'string'
          ? invoice.customer
          : invoice.customer?.id

        if (!customerId) break

        const { data: client } = await supabase
          .from('clients')
          .select('id, name')
          .eq('stripe_customer_id', customerId)
          .single()

        if (client) {
          // Update billing status
          await supabase
            .from('clients')
            .update({
              billing_status: 'past_due',
              updated_at: new Date().toISOString(),
            })
            .eq('id', client.id)

          // Log activity
          await supabase.from('activity_log').insert({
            client_id: client.id,
            actor_type: 'system',
            action: 'payment_failed',
            description: `Payment failed for ${client.name} - invoice ${invoice.id}`,
            metadata: {
              invoice_id: invoice.id,
              amount: invoice.amount_due,
              currency: invoice.currency,
              attempt_count: invoice.attempt_count,
            },
          })

          // Create notification for admins
          await supabase.from('notifications').insert({
            type: 'payment_failed',
            title: 'Payment Failed',
            message: `Payment failed for client "${client.name}". Invoice: ${invoice.id}. Please follow up.`,
            severity: 'warning',
            client_id: client.id,
            metadata: {
              invoice_id: invoice.id,
              amount: invoice.amount_due,
              currency: invoice.currency,
            },
          })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id

        if (!customerId) break

        const { data: client } = await supabase
          .from('clients')
          .select('id, name')
          .eq('stripe_customer_id', customerId)
          .single()

        if (client) {
          // Mark client as churned
          await supabase
            .from('clients')
            .update({
              status: 'CHURNED',
              billing_status: 'cancelled',
              subscription_ended_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', client.id)

          // Log activity
          await supabase.from('activity_log').insert({
            client_id: client.id,
            actor_type: 'system',
            action: 'subscription_cancelled',
            description: `Subscription cancelled for ${client.name}`,
            metadata: {
              subscription_id: subscription.id,
              cancel_reason: subscription.cancellation_details?.reason,
            },
          })

          // Create notification
          await supabase.from('notifications').insert({
            type: 'subscription_cancelled',
            title: 'Subscription Cancelled',
            message: `Client "${client.name}" subscription has been cancelled.`,
            severity: 'critical',
            client_id: client.id,
            metadata: {
              subscription_id: subscription.id,
            },
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = typeof subscription.customer === 'string'
          ? subscription.customer
          : subscription.customer?.id

        if (!customerId) break

        const { data: client } = await supabase
          .from('clients')
          .select('id, name')
          .eq('stripe_customer_id', customerId)
          .single()

        if (client) {
          // Determine billing status from subscription status
          let billingStatus = 'active'
          if (subscription.status === 'past_due') billingStatus = 'past_due'
          else if (subscription.status === 'unpaid') billingStatus = 'unpaid'
          else if (subscription.status === 'canceled') billingStatus = 'cancelled'
          else if (subscription.status === 'trialing') billingStatus = 'trialing'

          // Determine client status
          let clientStatus: string | undefined
          if (subscription.status === 'active' || subscription.status === 'trialing') {
            clientStatus = 'ACTIVE'
          } else if (subscription.status === 'paused') {
            clientStatus = 'PAUSED'
          }

          const updatePayload: Record<string, unknown> = {
            billing_status: billingStatus,
            stripe_subscription_id: subscription.id,
            updated_at: new Date().toISOString(),
          }
          if (clientStatus) {
            updatePayload.status = clientStatus
          }

          await supabase
            .from('clients')
            .update(updatePayload)
            .eq('id', client.id)

          // Log activity
          await supabase.from('activity_log').insert({
            client_id: client.id,
            actor_type: 'system',
            action: 'subscription_updated',
            description: `Subscription updated for ${client.name} - status: ${subscription.status}`,
            metadata: {
              subscription_id: subscription.id,
              status: subscription.status,
              current_period_end: (subscription as unknown as Record<string, unknown>).current_period_end ?? null,
            },
          })
        }
        break
      }

      default:
        // Unhandled event type - log and acknowledge
        console.log(`Unhandled Stripe webhook event type: ${event.type}`)
    }

    return NextResponse.json(
      { success: true, data: { received: true } },
      { status: 200 }
    )
  } catch (error) {
    console.error('Stripe webhook error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
