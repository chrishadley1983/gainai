/**
 * High-level verification helpers that accept database location IDs
 * and handle OAuth client retrieval internally.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthenticatedClient } from './auth'
import {
  fetchVerificationOptions as _fetchVerificationOptions,
  requestVerification as _requestVerification,
  completeVerification as _completeVerification,
} from './locations'

/**
 * Resolve a database location ID to its Google resource name.
 */
async function resolveGoogleLocationName(locationId: string): Promise<string> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('gbp_locations')
    .select('google_location_name')
    .eq('id', locationId)
    .single()

  if (error || !data?.google_location_name) {
    throw new Error(
      `No Google location name found for location ${locationId}: ${error?.message ?? 'not linked'}`
    )
  }

  return data.google_location_name
}

/**
 * Get available verification options for a location (by database ID).
 */
export async function getVerificationOptions(locationId: string) {
  const [locationName, authClient] = await Promise.all([
    resolveGoogleLocationName(locationId),
    getAuthenticatedClient(locationId),
  ])

  return _fetchVerificationOptions(locationName, authClient)
}

/**
 * Request verification for a location using the specified method.
 */
export async function requestVerification(locationId: string, method: string) {
  const [locationName, authClient] = await Promise.all([
    resolveGoogleLocationName(locationId),
    getAuthenticatedClient(locationId),
  ])

  return _requestVerification(locationName, method, authClient)
}

/**
 * Complete verification with a PIN code.
 */
export async function completeVerification(locationId: string, pin: string) {
  const [locationName, authClient] = await Promise.all([
    resolveGoogleLocationName(locationId),
    getAuthenticatedClient(locationId),
  ])

  // The complete endpoint uses the verification resource name, not the location name.
  // For now, we look up the latest pending verification for this location.
  const supabase = createAdminClient()
  const { data: location } = await supabase
    .from('gbp_locations')
    .select('metadata')
    .eq('id', locationId)
    .single()

  const metadata = (location?.metadata || {}) as Record<string, unknown>
  const verificationName =
    (metadata.pending_verification_name as string) || `${locationName}/verifications/latest`

  return _completeVerification(verificationName, pin, authClient)
}
