/**
 * Google Business Profile post management.
 *
 * Uses the My Business API v4 for creating, updating, deleting, and
 * listing local posts on a Google Business Profile location.
 */

import { OAuth2Client } from 'google-auth-library';
import { createAdminClient } from '@/lib/supabase/admin';
import { googleApiLimiter } from '@/lib/utils/rate-limiter';
import { getAuthenticatedClient } from './auth';
import type { GooglePost, GoogleAPIError } from './types';

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

  // DELETE responses may have no body
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a local post on a Google Business Profile location.
 *
 * @param locationName - The full resource name (e.g. "accounts/123/locations/456").
 * @param postData - The post payload matching GooglePost shape.
 * @param authClient - An authenticated OAuth2 client.
 */
export async function createPost(
  locationName: string,
  postData: Partial<GooglePost>,
  authClient: OAuth2Client
): Promise<GooglePost> {
  return apiRequest<GooglePost>(
    authClient,
    `${MBP_V4_BASE}/${locationName}/localPosts`,
    {
      method: 'POST',
      body: JSON.stringify(postData),
    }
  );
}

/**
 * Update an existing local post.
 *
 * @param postName - Full resource name of the post.
 * @param postData - The fields to update.
 * @param authClient - An authenticated OAuth2 client.
 */
export async function updatePost(
  postName: string,
  postData: Partial<GooglePost>,
  authClient: OAuth2Client
): Promise<GooglePost> {
  const updateMask = Object.keys(postData).join(',');

  return apiRequest<GooglePost>(
    authClient,
    `${MBP_V4_BASE}/${postName}?updateMask=${encodeURIComponent(updateMask)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(postData),
    }
  );
}

/**
 * Delete a local post.
 *
 * @param postName - Full resource name of the post.
 * @param authClient - An authenticated OAuth2 client.
 */
export async function deletePost(
  postName: string,
  authClient: OAuth2Client
): Promise<void> {
  await apiRequest<Record<string, never>>(
    authClient,
    `${MBP_V4_BASE}/${postName}`,
    { method: 'DELETE' }
  );
}

/**
 * List all local posts for a location.
 *
 * @param locationName - The full resource name of the location.
 * @param authClient - An authenticated OAuth2 client.
 * @returns An object containing an array of posts and an optional nextPageToken.
 */
export async function listPosts(
  locationName: string,
  authClient: OAuth2Client
): Promise<{ localPosts: GooglePost[]; nextPageToken?: string }> {
  const allPosts: GooglePost[] = [];
  let pageToken: string | undefined;

  do {
    const url = pageToken
      ? `${MBP_V4_BASE}/${locationName}/localPosts?pageToken=${encodeURIComponent(pageToken)}`
      : `${MBP_V4_BASE}/${locationName}/localPosts`;

    const result = await apiRequest<{
      localPosts?: GooglePost[];
      nextPageToken?: string;
    }>(authClient, url);

    if (result.localPosts) {
      allPosts.push(...result.localPosts);
    }

    pageToken = result.nextPageToken;
  } while (pageToken);

  return { localPosts: allPosts };
}

// ---------------------------------------------------------------------------
// Publish from DB to Google
// ---------------------------------------------------------------------------

/**
 * Publish a post from the local database to Google Business Profile.
 *
 * Reads the post record from the `posts` table, resolves the associated
 * location's Google resource name, creates the post on GBP, and updates
 * the database record with the resulting `google_post_id`.
 *
 * @param postId - The internal (database) post ID.
 */
export async function publishPost(postId: string): Promise<void> {
  const supabase = createAdminClient();

  try {
    // Fetch the post record
    const { data: post, error: postError } = await supabase
      .from('posts')
      .select(
        'id, location_id, title, content, post_type, call_to_action_type, call_to_action_url, media_urls, event_title, event_start_date, event_end_date, offer_coupon_code, offer_redeem_url, offer_terms'
      )
      .eq('id', postId)
      .single();

    if (postError || !post) {
      throw new Error(
        `Post ${postId} not found: ${postError?.message ?? 'no data'}`
      );
    }

    // Fetch the associated location
    const { data: location, error: locError } = await supabase
      .from('gbp_locations')
      .select('id, google_location_name')
      .eq('id', post.location_id)
      .single();

    if (locError || !location) {
      throw new Error(
        `Location for post ${postId} not found: ${locError?.message ?? 'no data'}`
      );
    }

    if (!location.google_location_name) {
      throw new Error(
        `Location ${location.id} has no Google location name linked.`
      );
    }

    const authClient = await getAuthenticatedClient(post.location_id);

    // Build the Google Post payload
    const googlePostData: Partial<GooglePost> = {
      summary: post.content ?? undefined,
      topicType: mapPostType(post.post_type),
    };

    // Attach media if present
    if (post.media_urls && Array.isArray(post.media_urls) && post.media_urls.length > 0) {
      googlePostData.media = post.media_urls.map((url: string) => ({
        mediaFormat: 'PHOTO' as const,
        sourceUrl: url,
      }));
    }

    // Call to action
    if (post.call_to_action_type) {
      googlePostData.callToAction = {
        actionType: post.call_to_action_type,
        url: post.call_to_action_url ?? undefined,
      };
    }

    // Event data
    if (post.post_type === 'EVENT' && post.event_start_date) {
      const start = new Date(post.event_start_date);
      const end = post.event_end_date
        ? new Date(post.event_end_date)
        : start;

      googlePostData.event = {
        title: post.event_title ?? post.title ?? undefined,
        schedule: {
          startDate: {
            year: start.getFullYear(),
            month: start.getMonth() + 1,
            day: start.getDate(),
          },
          endDate: {
            year: end.getFullYear(),
            month: end.getMonth() + 1,
            day: end.getDate(),
          },
        },
      };
    }

    // Offer data
    if (post.post_type === 'OFFER') {
      googlePostData.offer = {
        couponCode: post.offer_coupon_code ?? undefined,
        redeemOnlineUrl: post.offer_redeem_url ?? undefined,
        termsConditions: post.offer_terms ?? undefined,
      };
    }

    // Create the post on Google
    const createdPost = await createPost(
      location.google_location_name,
      googlePostData,
      authClient
    );

    // Save the Google post name back to the database
    const { error: updateError } = await supabase
      .from('posts')
      .update({
        google_post_id: createdPost.name ?? null,
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', postId);

    if (updateError) {
      console.error(
        `[google/posts] Failed to update post ${postId} after publish:`,
        updateError.message
      );
    }

    console.log(
      `[google/posts] Published post ${postId} to Google as ${createdPost.name}.`
    );
  } catch (err) {
    console.error(`[google/posts] publishPost failed for ${postId}:`, err);

    // Mark the post as failed in the database
    const supabaseForUpdate = createAdminClient();
    await supabaseForUpdate
      .from('posts')
      .update({
        status: 'failed',
        last_error: err instanceof Error ? err.message : String(err),
      })
      .eq('id', postId);

    throw err;
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Map internal post type strings to Google's topic type enum.
 */
function mapPostType(
  postType?: string
): GooglePost['topicType'] {
  switch (postType?.toUpperCase()) {
    case 'EVENT':
      return 'EVENT';
    case 'OFFER':
      return 'OFFER';
    case 'ALERT':
      return 'ALERT';
    case 'STANDARD':
    default:
      return 'STANDARD';
  }
}
