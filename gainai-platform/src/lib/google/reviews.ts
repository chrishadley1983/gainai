/**
 * Google Business Profile review management.
 *
 * Uses the My Business API v4 for listing reviews and posting replies,
 * plus helpers to sync reviews to the local database and publish
 * locally-drafted responses back to Google.
 */

import { OAuth2Client } from 'google-auth-library';
import { createAdminClient } from '@/lib/supabase/admin';
import { googleApiLimiter } from '@/lib/utils/rate-limiter';
import { getAuthenticatedClient } from './auth';
import type { GoogleReview, StarRating, GoogleAPIError } from './types';

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

const MBP_V4_BASE = 'https://mybusiness.googleapis.com/v4';

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

// ---------------------------------------------------------------------------
// API operations
// ---------------------------------------------------------------------------

/**
 * List reviews for a location, optionally using pagination.
 *
 * @param locationName - Full resource name (e.g. "accounts/123/locations/456").
 * @param authClient - An authenticated OAuth2 client.
 * @param pageToken - Optional pagination token from a previous response.
 */
export async function listReviews(
  locationName: string,
  authClient: OAuth2Client,
  pageToken?: string
): Promise<{
  reviews: GoogleReview[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
}> {
  let url = `${MBP_V4_BASE}/${locationName}/reviews`;
  if (pageToken) {
    url += `?pageToken=${encodeURIComponent(pageToken)}`;
  }

  const result = await apiRequest<{
    reviews?: GoogleReview[];
    averageRating?: number;
    totalReviewCount?: number;
    nextPageToken?: string;
  }>(authClient, url);

  return {
    reviews: result.reviews ?? [],
    averageRating: result.averageRating,
    totalReviewCount: result.totalReviewCount,
    nextPageToken: result.nextPageToken,
  };
}

/**
 * Reply to a review on Google.
 *
 * @param reviewName - Full resource name of the review.
 * @param comment - The reply text.
 * @param authClient - An authenticated OAuth2 client.
 */
export async function replyToReview(
  reviewName: string,
  comment: string,
  authClient: OAuth2Client
): Promise<{ comment: string; updateTime: string }> {
  return apiRequest<{ comment: string; updateTime: string }>(
    authClient,
    `${MBP_V4_BASE}/${reviewName}/reply`,
    {
      method: 'PUT',
      body: JSON.stringify({ comment }),
    }
  );
}

// ---------------------------------------------------------------------------
// Sync reviews from Google to DB
// ---------------------------------------------------------------------------

/**
 * Sync all reviews for a location from Google to the local database.
 *
 * Handles pagination, detects new reviews, performs basic sentiment analysis
 * based on star rating, and upserts reviews into the `reviews` table.
 *
 * @param locationId - The internal (database) location ID.
 */
export async function syncReviewsForLocation(
  locationId: string
): Promise<{ synced: number; newReviews: number }> {
  const supabase = createAdminClient();
  let synced = 0;
  let newReviews = 0;

  try {
    // Get the location's Google resource name
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

    // Paginate through all reviews
    let pageToken: string | undefined;

    do {
      const result = await listReviews(
        location.google_location_name,
        authClient,
        pageToken
      );

      for (const review of result.reviews) {
        if (!review.reviewId) continue;

        const sentiment = detectSentiment(review.starRating);

        const reviewPayload = {
          location_id: locationId,
          google_review_id: review.reviewId,
          google_review_name: review.name ?? null,
          reviewer_name: review.reviewer?.displayName ?? 'Anonymous',
          reviewer_photo_url: review.reviewer?.profilePhotoUrl ?? null,
          star_rating: starRatingToNumber(review.starRating),
          comment: review.comment ?? null,
          sentiment,
          review_reply: review.reviewReply?.comment ?? null,
          reply_time: review.reviewReply?.updateTime ?? null,
          google_created_at: review.createTime ?? null,
          google_updated_at: review.updateTime ?? null,
          synced_at: new Date().toISOString(),
        };

        // Upsert by google_review_id to avoid duplicates
        const { data: existing } = await supabase
          .from('reviews')
          .select('id')
          .eq('google_review_id', review.reviewId)
          .eq('location_id', locationId)
          .maybeSingle();

        if (existing) {
          // Update existing review
          await supabase
            .from('reviews')
            .update(reviewPayload)
            .eq('id', existing.id);
        } else {
          // Insert new review
          await supabase.from('reviews').insert(reviewPayload);
          newReviews++;
        }

        synced++;
      }

      // Update average rating on the location if available
      if (result.averageRating !== undefined) {
        await supabase
          .from('gbp_locations')
          .update({
            average_rating: result.averageRating,
            total_review_count: result.totalReviewCount ?? null,
            reviews_synced_at: new Date().toISOString(),
          })
          .eq('id', locationId);
      }

      pageToken = result.nextPageToken;
    } while (pageToken);

    console.log(
      `[google/reviews] Synced ${synced} reviews (${newReviews} new) for location ${locationId}.`
    );

    return { synced, newReviews };
  } catch (err) {
    console.error(
      `[google/reviews] syncReviewsForLocation failed for ${locationId}:`,
      err
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Publish review response from DB to Google
// ---------------------------------------------------------------------------

/**
 * Publish a locally-drafted review response to Google.
 *
 * Reads the response from the `reviews` table, posts it to Google via
 * the reply API, and marks the response as published in the database.
 *
 * @param reviewId - The internal (database) review ID.
 */
export async function publishReviewResponse(reviewId: string): Promise<void> {
  const supabase = createAdminClient();

  try {
    // Fetch the review record
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select(
        'id, location_id, google_review_name, draft_reply, reply_status'
      )
      .eq('id', reviewId)
      .single();

    if (reviewError || !review) {
      throw new Error(
        `Review ${reviewId} not found: ${reviewError?.message ?? 'no data'}`
      );
    }

    if (!review.google_review_name) {
      throw new Error(
        `Review ${reviewId} has no Google review name. Cannot post reply.`
      );
    }

    if (!review.draft_reply) {
      throw new Error(`Review ${reviewId} has no draft reply to publish.`);
    }

    const authClient = await getAuthenticatedClient(review.location_id);

    const result = await replyToReview(
      review.google_review_name,
      review.draft_reply,
      authClient
    );

    // Update the review record
    const { error: updateError } = await supabase
      .from('reviews')
      .update({
        review_reply: review.draft_reply,
        reply_time: result.updateTime ?? new Date().toISOString(),
        reply_status: 'published',
        reply_published_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (updateError) {
      console.error(
        `[google/reviews] Failed to update review ${reviewId} after publishing reply:`,
        updateError.message
      );
    }

    console.log(
      `[google/reviews] Published reply for review ${reviewId} to Google.`
    );
  } catch (err) {
    console.error(
      `[google/reviews] publishReviewResponse failed for ${reviewId}:`,
      err
    );

    // Mark as failed
    const supabaseForUpdate = createAdminClient();
    await supabaseForUpdate
      .from('reviews')
      .update({
        reply_status: 'failed',
        reply_error: err instanceof Error ? err.message : String(err),
      })
      .eq('id', reviewId);

    throw err;
  }
}

// ---------------------------------------------------------------------------
// Sentiment detection
// ---------------------------------------------------------------------------

/**
 * Basic sentiment classification based on star rating.
 * Returns 'positive', 'neutral', or 'negative'.
 */
function detectSentiment(
  starRating?: StarRating
): 'positive' | 'neutral' | 'negative' {
  switch (starRating) {
    case 'FIVE':
    case 'FOUR':
      return 'positive';
    case 'THREE':
      return 'neutral';
    case 'TWO':
    case 'ONE':
      return 'negative';
    default:
      return 'neutral';
  }
}

/**
 * Convert Google's StarRating enum to a numeric value.
 */
function starRatingToNumber(starRating?: StarRating): number | null {
  switch (starRating) {
    case 'ONE':
      return 1;
    case 'TWO':
      return 2;
    case 'THREE':
      return 3;
    case 'FOUR':
      return 4;
    case 'FIVE':
      return 5;
    default:
      return null;
  }
}
