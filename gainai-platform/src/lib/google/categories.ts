/**
 * Google Business Profile categories and attributes.
 *
 * Uses the Business Profile API to list available GBP categories
 * and retrieve attributes for a specific category. These endpoints
 * do not require per-location authentication -- they use a
 * service-level API key or basic OAuth client.
 */

import { googleApiLimiter } from '@/lib/utils/rate-limiter';
import { getOAuthClient } from './auth';
import type { GoogleCategory, GoogleAttribute, GoogleAPIError } from './types';

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

const BPP_BASE = 'https://mybusinessbusinessinformation.googleapis.com/v1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Make an authenticated request using a basic (non-location-specific)
 * OAuth client. Categories and attributes are account-level resources
 * that don't need per-location tokens.
 */
async function apiRequest<T>(url: string): Promise<T> {
  await googleApiLimiter.waitForSlot();

  const client = getOAuthClient();
  const accessTokenResponse = await client.getAccessToken();
  const accessToken = accessTokenResponse.token;

  // For category/attribute listing, we can also use an API key.
  // Fall back to using the API key if no access token is available.
  const apiKey = process.env.GOOGLE_API_KEY;

  let finalUrl = url;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else if (apiKey) {
    const separator = url.includes('?') ? '&' : '?';
    finalUrl = `${url}${separator}key=${encodeURIComponent(apiKey)}`;
  } else {
    throw new Error(
      'No access token or GOOGLE_API_KEY available for category API request.'
    );
  }

  const response = await fetch(finalUrl, { headers });

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
// Categories
// ---------------------------------------------------------------------------

/**
 * List available Google Business Profile categories.
 *
 * @param regionCode - ISO 3166-1 alpha-2 region code (default: "US").
 * @param languageCode - BCP 47 language code (default: "en").
 * @returns A list of categories.
 *
 * @see https://developers.google.com/my-business/reference/businessinformation/rest/v1/categories/list
 */
export async function listCategories(
  regionCode: string = 'US',
  languageCode: string = 'en'
): Promise<{ categories: GoogleCategory[] }> {
  const allCategories: GoogleCategory[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const params = new URLSearchParams({
        regionCode,
        languageCode,
        view: 'FULL',
        pageSize: '100',
      });

      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const result = await apiRequest<{
        categories?: GoogleCategory[];
        nextPageToken?: string;
      }>(`${BPP_BASE}/categories?${params.toString()}`);

      if (result.categories) {
        allCategories.push(...result.categories);
      }

      pageToken = result.nextPageToken;
    } while (pageToken);

    console.log(
      `[google/categories] Fetched ${allCategories.length} categories for ${regionCode}/${languageCode}.`
    );

    return { categories: allCategories };
  } catch (err) {
    console.error('[google/categories] listCategories failed:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Attributes
// ---------------------------------------------------------------------------

/**
 * Get the available attributes for a specific GBP category.
 *
 * @param categoryName - The full resource name of the category
 *                        (e.g. "gcid:restaurant").
 * @returns A list of attributes available for that category.
 *
 * @see https://developers.google.com/my-business/reference/businessinformation/rest/v1/attributes/list
 */
export async function getAttributes(
  categoryName: string
): Promise<{ attributes: GoogleAttribute[] }> {
  const allAttributes: GoogleAttribute[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const params = new URLSearchParams({
        categoryName,
        pageSize: '100',
      });

      if (pageToken) {
        params.set('pageToken', pageToken);
      }

      const result = await apiRequest<{
        attributes?: GoogleAttribute[];
        nextPageToken?: string;
      }>(`${BPP_BASE}/attributes?${params.toString()}`);

      if (result.attributes) {
        allAttributes.push(...result.attributes);
      }

      pageToken = result.nextPageToken;
    } while (pageToken);

    console.log(
      `[google/categories] Fetched ${allAttributes.length} attributes for category "${categoryName}".`
    );

    return { attributes: allAttributes };
  } catch (err) {
    console.error(
      `[google/categories] getAttributes failed for "${categoryName}":`,
      err
    );
    throw err;
  }
}
