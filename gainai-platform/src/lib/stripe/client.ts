import Stripe from 'stripe'

// ---------------------------------------------------------------------------
// Stripe client singleton
// ---------------------------------------------------------------------------

let stripeInstance: Stripe | null = null

/**
 * Get or create a Stripe SDK client instance.
 *
 * Reads `STRIPE_SECRET_KEY` from the environment. Throws if the key is not
 * configured.
 */
export function getStripeClient(): Stripe {
  if (stripeInstance) {
    return stripeInstance
  }

  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set. Add it to your environment variables.'
    )
  }

  stripeInstance = new Stripe(secretKey, {
    apiVersion: '2026-01-28.clover',
    typescript: true,
  })

  return stripeInstance
}
