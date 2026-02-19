import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, encryptToken } from '@/lib/google/oauth'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      const loginUrl = new URL('/login', request.nextUrl.origin)
      loginUrl.searchParams.set('error', 'auth_required')
      return NextResponse.redirect(loginUrl)
    }

    const code = request.nextUrl.searchParams.get('code')
    const locationId = request.nextUrl.searchParams.get('state')

    if (!code || !locationId) {
      const errorUrl = new URL('/admin/locations', request.nextUrl.origin)
      errorUrl.searchParams.set('error', 'missing_params')
      return NextResponse.redirect(errorUrl)
    }

    // Exchange the authorization code for tokens
    const tokens = await exchangeCodeForTokens(code)

    if (!tokens.refresh_token) {
      const errorUrl = new URL(`/admin/locations/${locationId}`, request.nextUrl.origin)
      errorUrl.searchParams.set('error', 'no_refresh_token')
      return NextResponse.redirect(errorUrl)
    }

    // Encrypt the refresh token before storing
    const encryptedToken = encryptToken(tokens.refresh_token)

    // Store the encrypted refresh token in the location record
    const { error: updateError } = await supabase
      .from('gbp_locations')
      .update({
        oauth_token_encrypted: encryptedToken,
        oauth_connected_at: new Date().toISOString(),
        oauth_status: 'CONNECTED',
      })
      .eq('id', locationId)

    if (updateError) {
      console.error('Failed to store OAuth token:', updateError)
      const errorUrl = new URL(`/admin/locations/${locationId}`, request.nextUrl.origin)
      errorUrl.searchParams.set('error', 'token_storage_failed')
      return NextResponse.redirect(errorUrl)
    }

    // Redirect to the location admin page with success
    const successUrl = new URL(`/admin/locations/${locationId}`, request.nextUrl.origin)
    successUrl.searchParams.set('oauth', 'success')
    return NextResponse.redirect(successUrl)
  } catch (error) {
    console.error('Google OAuth callback error:', error)
    const errorUrl = new URL('/admin/locations', request.nextUrl.origin)
    errorUrl.searchParams.set('error', 'oauth_failed')
    return NextResponse.redirect(errorUrl)
  }
}
