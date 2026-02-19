/**
 * Google Business Profile location CRUD, verification, and sync helpers.
 *
 * Uses the Business Profile API for location management and the
 * My Business Verifications API for verification workflows.
 */

import { OAuth2Client } from 'google-auth-library';
import { createAdminClient } from '@/lib/supabase/admin';
import { googleApiLimiter } from '@/lib/utils/rate-limiter';
import { getAuthenticatedClient } from './auth';
import type {
  GoogleLocation,
  VerificationOption,
  GoogleAPIError,
} from './types';

// ---------------------------------------------------------------------------
// Base URLs
// ---------------------------------------------------------------------------

const BPP_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const VERIFICATION_BASE = 'https://mybusinessverifications.googleapis.com/v1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Make an authenticated request against a Google Business Profile API endpoint.
 */
async function apiRequest<T>(
  client: OAuth2Client,
  url: string,
  options: RequestInit = {}
): Promise<T> {
  await googleApiLimiter.waitForSlot();

  const accessToken = (await client.getAccessToken()).token;
  if (!accessToken) {
    throw new Error('Unable to obtain access token for API request.');
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      error?: GoogleAPIError;
    };
    const apiError = errorBody.error;
    throw new Error(
      `Google API error ${response.status}: ${apiError?.message ?? response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Search for a Google location by query string.
 *
 * @see https://developers.google.com/my-business/reference/businessinformation/rest/v1/googleLocations/search
 */
export async function searchLocation(
  query: string,
  authClient: OAuth2Client
): Promise<{ googleLocations: GoogleLocation[] }> {
  return apiRequest<{ googleLocations: GoogleLocation[] }>(
    authClient,
    `${BPP_BASE}/googleLocations:search`,
    {
      method: 'POST',
      body: JSON.stringify({ query }),
    }
  );
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new location under a GBP account.
 *
 * @param accountId - The GBP account resource name (e.g. "accounts/123").
 * @param locationData - The location payload.
 * @param authClient - An authenticated OAuth2 client.
 */
export async function createLocation(
  accountId: string,
  locationData: Partial<GoogleLocation>,
  authClient: OAuth2Client
): Promise<GoogleLocation> {
  return apiRequest<GoogleLocation>(
    authClient,
    `${BPP_BASE}/${accountId}/locations`,
    {
      method: 'POST',
      body: JSON.stringify(locationData),
    }
  );
}

/**
 * Get a single location by its resource name.
 *
 * @param locationName - Full resource name (e.g. "locations/123456").
 */
export async function getLocation(
  locationName: string,
  authClient: OAuth2Client
): Promise<GoogleLocation> {
  const readMask =
    'name,title,storefrontAddress,phoneNumbers,categories,websiteUri,' +
    'regularHours,specialHours,latlng,openInfo,metadata,profile,labels';

  return apiRequest<GoogleLocation>(
    authClient,
    `${BPP_BASE}/${locationName}?readMask=${encodeURIComponent(readMask)}`
  );
}

/**
 * Update (patch) a location.
 *
 * @param locationName - Full resource name.
 * @param updateData - The fields to update.
 * @param authClient - An authenticated OAuth2 client.
 */
export async function updateLocation(
  locationName: string,
  updateData: Partial<GoogleLocation>,
  authClient: OAuth2Client
): Promise<GoogleLocation> {
  const updateMask = Object.keys(updateData).join(',');

  return apiRequest<GoogleLocation>(
    authClient,
    `${BPP_BASE}/${locationName}?updateMask=${encodeURIComponent(updateMask)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(updateData),
    }
  );
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/**
 * Fetch the available verification options for a location.
 *
 * @param locationName - Full resource name (e.g. "locations/123456").
 */
export async function fetchVerificationOptions(
  locationName: string,
  authClient: OAuth2Client
): Promise<{ options: VerificationOption[] }> {
  return apiRequest<{ options: VerificationOption[] }>(
    authClient,
    `${VERIFICATION_BASE}/${locationName}:fetchVerificationOptions`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    }
  );
}

/**
 * Initiate a verification request for a location.
 *
 * @param locationName - Full resource name.
 * @param method - The verification method to use (e.g. "SMS", "PHONE_CALL").
 */
export async function requestVerification(
  locationName: string,
  method: string,
  authClient: OAuth2Client
): Promise<{ verification: { name: string; method: string; state: string } }> {
  return apiRequest<{
    verification: { name: string; method: string; state: string };
  }>(authClient, `${VERIFICATION_BASE}/${locationName}/verifications`, {
    method: 'POST',
    body: JSON.stringify({ method }),
  });
}

/**
 * Complete a verification request using a PIN.
 *
 * @param verificationId - Full resource name of the verification.
 * @param pin - The PIN code received by the business owner.
 */
export async function completeVerification(
  verificationId: string,
  pin: string,
  authClient: OAuth2Client
): Promise<{ verification: { name: string; state: string } }> {
  return apiRequest<{ verification: { name: string; state: string } }>(
    authClient,
    `${VERIFICATION_BASE}/${verificationId}:complete`,
    {
      method: 'POST',
      body: JSON.stringify({ pin }),
    }
  );
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

/**
 * Perform a full sync of a location's data from Google to the local database.
 *
 * Fetches the latest location details from Google, then upserts the
 * relevant fields into the `locations` table.
 *
 * @param locationId - The internal (database) location ID.
 */
export async function syncLocationFromGoogle(
  locationId: string
): Promise<void> {
  const supabase = createAdminClient();

  try {
    // Look up the Google resource name stored for this location
    const { data: locationRow, error: fetchError } = await supabase
      .from('gbp_locations')
      .select('id, google_location_name, google_account_id')
      .eq('id', locationId)
      .single();

    if (fetchError || !locationRow) {
      throw new Error(
        `Location ${locationId} not found: ${fetchError?.message ?? 'no data'}`
      );
    }

    if (!locationRow.google_location_name) {
      throw new Error(
        `Location ${locationId} has no linked Google location name.`
      );
    }

    const authClient = await getAuthenticatedClient(locationId);
    const googleLocation = await getLocation(
      locationRow.google_location_name,
      authClient
    );

    // Map Google fields to local columns
    const updatePayload: Record<string, unknown> = {
      google_location_data: googleLocation,
      business_name: googleLocation.title ?? null,
      phone:
        googleLocation.phoneNumbers?.primaryPhone ?? null,
      website: googleLocation.websiteUri ?? null,
      google_maps_url: googleLocation.metadata?.mapsUri ?? null,
      primary_category:
        googleLocation.categories?.primaryCategory?.displayName ?? null,
      description: googleLocation.profile?.description ?? null,
      google_synced_at: new Date().toISOString(),
    };

    // Flatten address
    const addr = googleLocation.storefrontAddress;
    if (addr) {
      updatePayload.address_line1 = addr.addressLines?.[0] ?? null;
      updatePayload.address_line2 = addr.addressLines?.[1] ?? null;
      updatePayload.city = addr.locality ?? null;
      updatePayload.state = addr.administrativeArea ?? null;
      updatePayload.postal_code = addr.postalCode ?? null;
      updatePayload.country = addr.regionCode ?? null;
    }

    // Coordinates
    if (googleLocation.latlng) {
      updatePayload.latitude = googleLocation.latlng.latitude;
      updatePayload.longitude = googleLocation.latlng.longitude;
    }

    const { error: updateError } = await supabase
      .from('gbp_locations')
      .update(updatePayload)
      .eq('id', locationId);

    if (updateError) {
      throw new Error(
        `Failed to update location ${locationId}: ${updateError.message}`
      );
    }

    console.log(
      `[google/locations] Synced location ${locationId} from Google.`
    );
  } catch (err) {
    console.error(
      `[google/locations] syncLocationFromGoogle failed for ${locationId}:`,
      err
    );
    throw err;
  }
}
