/**
 * Google Business Profile media management.
 *
 * Uses the My Business API v4 for uploading, deleting, and listing
 * media items (photos and videos) on a Google Business Profile location.
 */

import { OAuth2Client } from 'google-auth-library';
import { googleApiLimiter } from '@/lib/utils/rate-limiter';
import type { GoogleMediaItem, MediaCategory, GoogleAPIError } from './types';

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

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Media operations
// ---------------------------------------------------------------------------

export interface UploadMediaData {
  /** The source URL of the media item (publicly accessible). */
  sourceUrl: string;
  /** The format of the media: PHOTO or VIDEO. */
  mediaFormat: 'PHOTO' | 'VIDEO';
  /** The category for the media item. */
  category?: MediaCategory;
  /** Optional description for the media item. */
  description?: string;
}

/**
 * Upload a photo or video to a Google Business Profile location.
 *
 * @param locationName - Full resource name (e.g. "accounts/123/locations/456").
 * @param mediaData - The media payload with source URL and format.
 * @param authClient - An authenticated OAuth2 client.
 */
export async function uploadMedia(
  locationName: string,
  mediaData: UploadMediaData,
  authClient: OAuth2Client
): Promise<GoogleMediaItem> {
  const payload: Record<string, unknown> = {
    mediaFormat: mediaData.mediaFormat,
    sourceUrl: mediaData.sourceUrl,
  };

  if (mediaData.category) {
    payload.locationAssociation = {
      category: mediaData.category,
    };
  }

  if (mediaData.description) {
    payload.description = mediaData.description;
  }

  return apiRequest<GoogleMediaItem>(
    authClient,
    `${MBP_V4_BASE}/${locationName}/media`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Delete a media item from a Google Business Profile location.
 *
 * @param mediaName - Full resource name of the media item.
 * @param authClient - An authenticated OAuth2 client.
 */
export async function deleteMedia(
  mediaName: string,
  authClient: OAuth2Client
): Promise<void> {
  await apiRequest<Record<string, never>>(
    authClient,
    `${MBP_V4_BASE}/${mediaName}`,
    { method: 'DELETE' }
  );
}

/**
 * List all media items for a Google Business Profile location.
 *
 * Automatically paginates to retrieve all items.
 *
 * @param locationName - Full resource name of the location.
 * @param authClient - An authenticated OAuth2 client.
 */
export async function listMedia(
  locationName: string,
  authClient: OAuth2Client
): Promise<{ mediaItems: GoogleMediaItem[]; totalMediaItemCount?: number }> {
  const allMedia: GoogleMediaItem[] = [];
  let pageToken: string | undefined;
  let totalCount: number | undefined;

  do {
    const url = pageToken
      ? `${MBP_V4_BASE}/${locationName}/media?pageToken=${encodeURIComponent(pageToken)}`
      : `${MBP_V4_BASE}/${locationName}/media`;

    const result = await apiRequest<{
      mediaItems?: GoogleMediaItem[];
      totalMediaItemCount?: number;
      nextPageToken?: string;
    }>(authClient, url);

    if (result.mediaItems) {
      allMedia.push(...result.mediaItems);
    }

    if (result.totalMediaItemCount !== undefined) {
      totalCount = result.totalMediaItemCount;
    }

    pageToken = result.nextPageToken;
  } while (pageToken);

  return {
    mediaItems: allMedia,
    totalMediaItemCount: totalCount,
  };
}
