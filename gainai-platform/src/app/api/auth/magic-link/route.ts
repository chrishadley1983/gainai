import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, clientSlug } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Email is required' } },
        { status: 400 }
      )
    }

    if (!clientSlug || typeof clientSlug !== 'string') {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_INPUT', message: 'Client slug is required' } },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()

    // Verify the client exists and is active
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id, name, status')
      .eq('slug', clientSlug)
      .single()

    if (clientError || !client) {
      return NextResponse.json(
        { success: false, error: { code: 'CLIENT_NOT_FOUND', message: 'Client not found' } },
        { status: 404 }
      )
    }

    if (client.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: { code: 'CLIENT_INACTIVE', message: 'Client account is not active' } },
        { status: 403 }
      )
    }

    // Verify the email belongs to a client_user for this client
    const { data: clientUser, error: userError } = await supabase
      .from('client_users')
      .select('id, email')
      .eq('client_id', client.id)
      .eq('email', email.toLowerCase())
      .single()

    if (userError || !clientUser) {
      // Return a generic message to avoid leaking whether the email exists
      return NextResponse.json(
        { success: true, data: { message: 'If this email is associated with a client account, a magic link has been sent.' } },
        { status: 200 }
      )
    }

    // Generate and send the magic link
    const origin = request.nextUrl.origin
    const { error: otpError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email.toLowerCase(),
      options: {
        redirectTo: `${origin}/auth/callback`,
      },
    })

    if (otpError) {
      console.error('Magic link generation error:', otpError)
      return NextResponse.json(
        { success: false, error: { code: 'MAGIC_LINK_FAILED', message: 'Failed to send magic link. Please try again.' } },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { success: true, data: { message: 'If this email is associated with a client account, a magic link has been sent.' } },
      { status: 200 }
    )
  } catch (error) {
    console.error('Magic link API error:', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' } },
      { status: 500 }
    )
  }
}
