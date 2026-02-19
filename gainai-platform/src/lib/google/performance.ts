/**
 * Google Business Profile performance metrics and search keyword data.
 *
 * Uses the Business Profile Performance API for fetching daily metrics
 * timeseries and search keyword impression data, plus helpers to sync
 * the data into the local database.
 */

import { OAuth2Client } from 'google-auth-library';
import { createAdminClient } from '@/lib/supabase/admin';
import { googleApiLimiter } from '@/lib/utils/rate-limiter';
import { getAuthenticatedClient } from './auth';
import type {
  DailyMetricValue,
  PerformanceMetrics,
  SearchKeywordCount,
  SearchKeywordData,
  GoogleAPIError,
} from './types';

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

const PERFORMANCE_BASE =
  'https://businessprofileperformance.googleapis.com/v1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/**
 * Format a Date as a YYYY-MM-DD string suitable for the Google API date params.
 */
function formatDateParam(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Convert a Google date object { year, month, day } to a Date-string "YYYY-MM-DD".
 */
function googleDateToString(gd: {
  year: number;
  month: number;
  day: number;
}): string {
  return `${gd.year}-${String(gd.month).padStart(2, '0')}-${String(gd.day).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Fetch daily metrics
// ---------------------------------------------------------------------------

/**
 * Fetch daily performance metrics timeseries for a location.
 *
 * @param locationName - Full resource name (e.g. "locations/123456").
 * @param startDate - Start of the date range (inclusive).
 * @param endDate - End of the date range (inclusive).
 * @param authClient - An authenticated OAuth2 client.
 * @returns The performance metrics timeseries.
 *
 * @see https://developers.google.com/my-business/reference/performance/rest/v1/locations/fetchMultiDailyMetricsTimeSeries
 */
export async function fetchDailyMetrics(
  locationName: string,
  startDate: Date,
  endDate: Date,
  authClient: OAuth2Client
): Promise<PerformanceMetrics> {
  const dailyMetrics = [
    'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
    'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
    'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
    'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
    'BUSINESS_DIRECTION_REQUESTS',
    'CALL_CLICKS',
    'WEBSITE_CLICKS',
    'BUSINESS_CONVERSATIONS',
    'BUSINESS_BOOKINGS',
    'BUSINESS_FOOD_ORDERS',
  ];

  const params = new URLSearchParams();
  params.set(
    'dailyRange.startDate.year',
    String(startDate.getFullYear())
  );
  params.set(
    'dailyRange.startDate.month',
    String(startDate.getMonth() + 1)
  );
  params.set(
    'dailyRange.startDate.day',
    String(startDate.getDate())
  );
  params.set(
    'dailyRange.endDate.year',
    String(endDate.getFullYear())
  );
  params.set(
    'dailyRange.endDate.month',
    String(endDate.getMonth() + 1)
  );
  params.set(
    'dailyRange.endDate.day',
    String(endDate.getDate())
  );

  for (const metric of dailyMetrics) {
    params.append('dailyMetrics', metric);
  }

  const result = await apiRequest<{
    multiDailyMetricTimeSeries?: {
      dailyMetricTimeSeries?: DailyMetricValue[];
    }[];
  }>(
    authClient,
    `${PERFORMANCE_BASE}/${locationName}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`
  );

  // Flatten the nested response
  const timeSeries: DailyMetricValue[] = [];
  if (result.multiDailyMetricTimeSeries) {
    for (const entry of result.multiDailyMetricTimeSeries) {
      if (entry.dailyMetricTimeSeries) {
        timeSeries.push(...entry.dailyMetricTimeSeries);
      }
    }
  }

  return {
    locationName,
    timeSeries,
  };
}

// ---------------------------------------------------------------------------
// Fetch search keywords
// ---------------------------------------------------------------------------

/**
 * Fetch search keyword impression data for a location.
 *
 * @param locationName - Full resource name (e.g. "locations/123456").
 * @param startDate - Start of the date range (inclusive).
 * @param endDate - End of the date range (inclusive).
 * @param authClient - An authenticated OAuth2 client.
 * @returns The search keyword data.
 *
 * @see https://developers.google.com/my-business/reference/performance/rest/v1/locations/searchkeywords/impressions/monthly
 */
export async function fetchSearchKeywords(
  locationName: string,
  startDate: Date,
  endDate: Date,
  authClient: OAuth2Client
): Promise<SearchKeywordData> {
  const allKeywords: SearchKeywordCount[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams();
    params.set(
      'monthlyRange.startMonth.year',
      String(startDate.getFullYear())
    );
    params.set(
      'monthlyRange.startMonth.month',
      String(startDate.getMonth() + 1)
    );
    params.set(
      'monthlyRange.endMonth.year',
      String(endDate.getFullYear())
    );
    params.set(
      'monthlyRange.endMonth.month',
      String(endDate.getMonth() + 1)
    );

    if (pageToken) {
      params.set('pageToken', pageToken);
    }

    const result = await apiRequest<{
      searchKeywordsCounts?: SearchKeywordCount[];
      nextPageToken?: string;
    }>(
      authClient,
      `${PERFORMANCE_BASE}/${locationName}/searchkeywords/impressions/monthly?${params.toString()}`
    );

    if (result.searchKeywordsCounts) {
      allKeywords.push(...result.searchKeywordsCounts);
    }

    pageToken = result.nextPageToken;
  } while (pageToken);

  return { searchKeywordsCounts: allKeywords };
}

// ---------------------------------------------------------------------------
// Sync performance metrics to DB
// ---------------------------------------------------------------------------

/**
 * Sync daily performance metrics from Google to the local database.
 *
 * Fetches the last 30 days of metrics and upserts them into the
 * `location_metrics` table.
 *
 * @param locationId - The internal (database) location ID.
 */
export async function syncPerformanceForLocation(
  locationId: string
): Promise<{ synced: number }> {
  const supabase = createAdminClient();
  let synced = 0;

  try {
    const { data: location, error: locError } = await supabase
      .from('gbp_locations')
      .select('id, google_location_name')
      .eq('id', locationId)
      .single();

    if (locError || !location) {
      throw new Error(
        `Location ${locationId} not found: ${locError?.message ?? 'no data'}`
      );
    }

    if (!location.google_location_name) {
      throw new Error(
        `Location ${locationId} has no linked Google location name.`
      );
    }

    const authClient = await getAuthenticatedClient(locationId);

    // Fetch last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const metrics = await fetchDailyMetrics(
      location.google_location_name,
      startDate,
      endDate,
      authClient
    );

    if (!metrics.timeSeries || metrics.timeSeries.length === 0) {
      console.log(
        `[google/performance] No daily metrics found for location ${locationId}.`
      );
      return { synced: 0 };
    }

    // Build a map of date -> metric values
    const dateMetricsMap = new Map<string, Record<string, number>>();

    for (const series of metrics.timeSeries) {
      if (!series.timeSeries?.datedValues) continue;

      for (const dv of series.timeSeries.datedValues) {
        const dateStr = googleDateToString(dv.date);
        const existing = dateMetricsMap.get(dateStr) ?? {};
        existing[series.metric] = parseInt(dv.value ?? '0', 10);
        dateMetricsMap.set(dateStr, existing);
      }
    }

    // Upsert each day's metrics
    for (const [dateStr, metricValues] of dateMetricsMap) {
      const payload = {
        location_id: locationId,
        date: dateStr,
        impressions_desktop_maps:
          metricValues['BUSINESS_IMPRESSIONS_DESKTOP_MAPS'] ?? 0,
        impressions_desktop_search:
          metricValues['BUSINESS_IMPRESSIONS_DESKTOP_SEARCH'] ?? 0,
        impressions_mobile_maps:
          metricValues['BUSINESS_IMPRESSIONS_MOBILE_MAPS'] ?? 0,
        impressions_mobile_search:
          metricValues['BUSINESS_IMPRESSIONS_MOBILE_SEARCH'] ?? 0,
        direction_requests:
          metricValues['BUSINESS_DIRECTION_REQUESTS'] ?? 0,
        call_clicks: metricValues['CALL_CLICKS'] ?? 0,
        website_clicks: metricValues['WEBSITE_CLICKS'] ?? 0,
        conversations: metricValues['BUSINESS_CONVERSATIONS'] ?? 0,
        bookings: metricValues['BUSINESS_BOOKINGS'] ?? 0,
        food_orders: metricValues['BUSINESS_FOOD_ORDERS'] ?? 0,
        synced_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('performance_daily')
        .upsert(payload, {
          onConflict: 'location_id,date',
        });

      if (upsertError) {
        console.error(
          `[google/performance] Failed to upsert metrics for ${locationId} on ${dateStr}:`,
          upsertError.message
        );
      } else {
        synced++;
      }
    }

    // Update last sync timestamp
    await supabase
      .from('gbp_locations')
      .update({ metrics_synced_at: new Date().toISOString() })
      .eq('id', locationId);

    console.log(
      `[google/performance] Synced ${synced} days of metrics for location ${locationId}.`
    );

    return { synced };
  } catch (err) {
    console.error(
      `[google/performance] syncPerformanceForLocation failed for ${locationId}:`,
      err
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Sync search keywords to DB
// ---------------------------------------------------------------------------

/**
 * Sync search keyword impression data from Google to the local database.
 *
 * Fetches keywords for the last 3 months and upserts them into the
 * `location_keywords` table.
 *
 * @param locationId - The internal (database) location ID.
 */
export async function syncKeywordsForLocation(
  locationId: string
): Promise<{ synced: number }> {
  const supabase = createAdminClient();
  let synced = 0;

  try {
    const { data: location, error: locError } = await supabase
      .from('gbp_locations')
      .select('id, google_location_name')
      .eq('id', locationId)
      .single();

    if (locError || !location) {
      throw new Error(
        `Location ${locationId} not found: ${locError?.message ?? 'no data'}`
      );
    }

    if (!location.google_location_name) {
      throw new Error(
        `Location ${locationId} has no linked Google location name.`
      );
    }

    const authClient = await getAuthenticatedClient(locationId);

    // Fetch last 3 months of keyword data
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 3);

    const keywordData = await fetchSearchKeywords(
      location.google_location_name,
      startDate,
      endDate,
      authClient
    );

    if (
      !keywordData.searchKeywordsCounts ||
      keywordData.searchKeywordsCounts.length === 0
    ) {
      console.log(
        `[google/performance] No keyword data found for location ${locationId}.`
      );
      return { synced: 0 };
    }

    // Build the sync period identifier for upsert deduplication
    const syncPeriod = `${formatDateParam(startDate)}_${formatDateParam(endDate)}`;

    for (const kw of keywordData.searchKeywordsCounts) {
      const payload = {
        location_id: locationId,
        keyword: kw.searchKeyword,
        impressions: parseInt(kw.insightCount?.value ?? '0', 10),
        sync_period: syncPeriod,
        synced_at: new Date().toISOString(),
      };

      const { error: upsertError } = await supabase
        .from('search_keywords')
        .upsert(payload, {
          onConflict: 'location_id,keyword,sync_period',
        });

      if (upsertError) {
        console.error(
          `[google/performance] Failed to upsert keyword "${kw.searchKeyword}" for ${locationId}:`,
          upsertError.message
        );
      } else {
        synced++;
      }
    }

    // Update last sync timestamp
    await supabase
      .from('gbp_locations')
      .update({ keywords_synced_at: new Date().toISOString() })
      .eq('id', locationId);

    console.log(
      `[google/performance] Synced ${synced} keywords for location ${locationId}.`
    );

    return { synced };
  } catch (err) {
    console.error(
      `[google/performance] syncKeywordsForLocation failed for ${locationId}:`,
      err
    );
    throw err;
  }
}
