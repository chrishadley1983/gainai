import type Stripe from 'stripe'
import { getStripeClient } from './client'
import { createAdminClient } from '@/lib/supabase/admin'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateCustomerResult {
  customerId: string
  customer: Stripe.Customer
}

export interface CreateSubscriptionResult {
  subscriptionId: string
  subscription: Stripe.Subscription
  clientSecret: string | null
}

export interface SubscriptionStatus {
  id: string
  status: Stripe.Subscription.Status
  currentPeriodStart: Date
  currentPeriodEnd: Date
  cancelAtPeriodEnd: boolean
  canceledAt: Date | null
}

// ---------------------------------------------------------------------------
// createCustomer – create a Stripe customer for a client
// ---------------------------------------------------------------------------

/**
 * Create a Stripe customer and link it to the given client in the database.
 *
 * @param clientId - Internal client ID.
 * @param email - Customer billing email.
 * @param name - Customer display name.
 */
export async function createCustomer(
  clientId: string,
  email: string,
  name: string
): Promise<CreateCustomerResult> {
  const stripe = getStripeClient()

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: {
      gainai_client_id: clientId,
    },
  })

  // Persist the Stripe customer ID on the client record
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('clients')
    .update({
      stripe_customer_id: customer.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', clientId)

  if (error) {
    // Attempt to clean up the Stripe customer if DB update fails
    console.error(
      `[stripe/billing] Failed to save customer ID to client ${clientId}: ${error.message}`
    )
    await stripe.customers.del(customer.id).catch(() => {
      // Best-effort cleanup
    })
    throw new Error(`Failed to link Stripe customer to client: ${error.message}`)
  }

  console.log(
    `[stripe/billing] Created Stripe customer ${customer.id} for client ${clientId}`
  )

  return { customerId: customer.id, customer }
}

// ---------------------------------------------------------------------------
// createSubscription – create a new subscription for a customer
// ---------------------------------------------------------------------------

/**
 * Create a Stripe subscription for the given customer with the specified price.
 *
 * @param customerId - Stripe customer ID.
 * @param priceId - Stripe price ID for the subscription plan.
 */
export async function createSubscription(
  customerId: string,
  priceId: string
): Promise<CreateSubscriptionResult> {
  const stripe = getStripeClient()

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
  })

  // Extract the client secret for front-end payment confirmation
  let clientSecret: string | null = null
  const latestInvoice = subscription.latest_invoice as unknown as Record<string, unknown> | string | null
  if (latestInvoice && typeof latestInvoice !== 'string') {
    const paymentIntent = latestInvoice.payment_intent as Record<string, unknown> | string | null
    if (paymentIntent && typeof paymentIntent !== 'string') {
      clientSecret = (paymentIntent.client_secret as string) ?? null
    }
  }

  // Save the subscription ID on the client record
  const supabase = createAdminClient()
  await supabase
    .from('clients')
    .update({
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_customer_id', customerId)

  console.log(
    `[stripe/billing] Created subscription ${subscription.id} for customer ${customerId}`
  )

  return {
    subscriptionId: subscription.id,
    subscription,
    clientSecret,
  }
}

// ---------------------------------------------------------------------------
// cancelSubscription – cancel an existing subscription
// ---------------------------------------------------------------------------

/**
 * Cancel a Stripe subscription. By default, cancels at the end of the current
 * billing period (not immediately).
 *
 * @param subscriptionId - Stripe subscription ID.
 * @param immediately - If true, cancels immediately instead of at period end.
 */
export async function cancelSubscription(
  subscriptionId: string,
  immediately = false
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient()

  let subscription: Stripe.Subscription

  if (immediately) {
    subscription = await stripe.subscriptions.cancel(subscriptionId)
  } else {
    subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })
  }

  // Update the client record
  const supabase = createAdminClient()
  await supabase
    .from('clients')
    .update({
      stripe_subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq('stripe_subscription_id', subscriptionId)

  console.log(
    `[stripe/billing] Cancelled subscription ${subscriptionId} (immediate: ${immediately})`
  )

  return subscription
}

// ---------------------------------------------------------------------------
// getSubscriptionStatus – retrieve the current status of a subscription
// ---------------------------------------------------------------------------

/**
 * Get the current status details of a Stripe subscription.
 *
 * @param subscriptionId - Stripe subscription ID.
 */
export async function getSubscriptionStatus(
  subscriptionId: string
): Promise<SubscriptionStatus> {
  const stripe = getStripeClient()
  const subscription = await stripe.subscriptions.retrieve(subscriptionId) as unknown as Record<string, unknown>

  return {
    id: subscription.id as string,
    status: subscription.status as Stripe.Subscription.Status,
    currentPeriodStart: new Date((subscription.current_period_start as number) * 1000),
    currentPeriodEnd: new Date((subscription.current_period_end as number) * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end as boolean,
    canceledAt: subscription.canceled_at
      ? new Date((subscription.canceled_at as number) * 1000)
      : null,
  }
}
