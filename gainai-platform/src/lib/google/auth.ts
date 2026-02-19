/**
 * Google OAuth2 helpers for Google Business Profile API integration.
 *
 * Handles OAuth client creation, consent URL generation, token exchange,
 * refresh, and retrieval of authenticated clients for specific locations.
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptToken, decryptToken } from '@/lib/utils/encryption';
import type { OAuthTokens } from './types';

// Scopes required for Google Business Profile APIs
const GBP_SCOPES = [
  'https://www.googleapis.com/auth/business.manage',
  'https://www.googleapis.com/auth/plus.business.manage',
];

/**
 * Create a base OAuth2 client configured with application credentials.
 */
export function getOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      'Missing Google OAuth environment variables. ' +
        'Ensure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI are set.'
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/**
 * Generate an OAuth2 consent URL for a given location.
 *
 * The `locationId` is passed through the `state` parameter so the callback
 * can associate the resulting tokens with the correct location record.
 *
 * @param locationId - The internal location ID to bind tokens to.
 * @returns The authorization URL the user should be redirected to.
 */
export function getAuthUrl(locationId: string): string {
  const client = getOAuthClient();

  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GBP_SCOPES,
    state: locationId,
  });
}

/**
 * Exchange an authorization code for OAuth tokens.
 *
 * @param code - The authorization code received from Google's redirect.
 * @returns The token set containing access_token, refresh_token, and expiry_date.
 */
export async function exchangeCode(code: string): Promise<OAuthTokens> {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error(
      'Token exchange did not return the expected tokens. ' +
        'Ensure the consent prompt requested offline access.'
    );
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date ?? Date.now() + 3600 * 1000,
    token_type: tokens.token_type ?? 'Bearer',
    scope: tokens.scope ?? GBP_SCOPES.join(' '),
  };
}

/**
 * Refresh an expired access token using a stored refresh token.
 *
 * @param refreshToken - The refresh token to use.
 * @returns A fresh set of tokens.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<OAuthTokens> {
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });

  const { credentials } = await client.refreshAccessToken();

  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token.');
  }

  return {
    access_token: credentials.access_token,
    refresh_token: credentials.refresh_token ?? refreshToken,
    expiry_date: credentials.expiry_date ?? Date.now() + 3600 * 1000,
    token_type: credentials.token_type ?? 'Bearer',
    scope: credentials.scope ?? GBP_SCOPES.join(' '),
  };
}

/**
 * Get an authenticated OAuth2 client for a specific location.
 *
 * Retrieves the encrypted tokens from the database, decrypts them,
 * checks whether the access token has expired, refreshes if necessary,
 * and returns a ready-to-use OAuth2Client.
 *
 * If the token was refreshed, the updated (re-encrypted) token is persisted
 * back to the database.
 *
 * @param locationId - The internal location ID whose tokens to load.
 * @returns An OAuth2Client with valid credentials set.
 */
export async function getAuthenticatedClient(
  locationId: string
): Promise<OAuth2Client> {
  const supabase = createAdminClient();

  // Fetch the encrypted tokens for this location
  const { data: location, error } = await supabase
    .from('gbp_locations')
    .select('google_access_token, google_refresh_token, google_token_expiry')
    .eq('id', locationId)
    .single();

  if (error || !location) {
    throw new Error(
      `Failed to retrieve Google tokens for location ${locationId}: ${error?.message ?? 'not found'}`
    );
  }

  if (!location.google_refresh_token) {
    throw new Error(
      `No Google refresh token stored for location ${locationId}. ` +
        'The user must re-authorize via OAuth.'
    );
  }

  // Decrypt stored tokens
  const refreshToken = decryptToken(location.google_refresh_token);
  let accessToken = location.google_access_token
    ? decryptToken(location.google_access_token)
    : null;
  let expiryDate = location.google_token_expiry
    ? new Date(location.google_token_expiry).getTime()
    : 0;

  // Determine whether the access token needs refreshing.
  // Refresh if it expires within the next 5 minutes.
  const needsRefresh = !accessToken || Date.now() >= expiryDate - 5 * 60 * 1000;

  if (needsRefresh) {
    console.log(
      `[google/auth] Refreshing access token for location ${locationId}`
    );

    const refreshed = await refreshAccessToken(refreshToken);
    accessToken = refreshed.access_token;
    expiryDate = refreshed.expiry_date;

    // Persist the refreshed token back to the database
    const { error: updateError } = await supabase
      .from('gbp_locations')
      .update({
        google_access_token: encryptToken(refreshed.access_token),
        google_refresh_token: encryptToken(refreshed.refresh_token),
        google_token_expiry: new Date(refreshed.expiry_date).toISOString(),
      })
      .eq('id', locationId);

    if (updateError) {
      console.error(
        `[google/auth] Failed to persist refreshed tokens for location ${locationId}:`,
        updateError.message
      );
    }
  }

  // Build and return the authenticated client
  const client = getOAuthClient();
  client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiryDate,
  });

  return client;
}
