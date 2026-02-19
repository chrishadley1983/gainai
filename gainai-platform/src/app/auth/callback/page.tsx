import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AuthCallbackPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string; error_description?: string }>
}) {
  const { code, error, error_description } = await searchParams

  // Handle OAuth/magic link errors passed via query params
  if (error) {
    const message = error_description || error
    redirect(`/auth/login?error=${encodeURIComponent(message)}`)
  }

  if (!code) {
    redirect('/auth/login?error=Missing+authentication+code')
  }

  const supabase = await createClient()

  // Exchange the code for a session
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    redirect(`/auth/login?error=${encodeURIComponent(exchangeError.message)}`)
  }

  // Get the authenticated user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login?error=Authentication+failed')
  }

  // Check if user is a team member
  const { data: teamMember } = await supabase
    .from('team_members')
    .select('id, role')
    .eq('user_id', user.id)
    .single()

  if (teamMember) {
    redirect('/admin/dashboard')
  }

  // Check if user is a client user
  const { data: clientUser } = await supabase
    .from('client_users')
    .select('id, client_id')
    .eq('user_id', user.id)
    .single()

  if (clientUser) {
    // Get the client slug for the redirect
    const { data: client } = await supabase
      .from('clients')
      .select('slug')
      .eq('id', clientUser.client_id)
      .single()

    if (client?.slug) {
      redirect(`/client/${client.slug}`)
    }

    // Fallback if client not found (should not happen)
    redirect('/auth/login?error=Client+account+not+found')
  }

  // User exists in auth but is not a team member or client user
  redirect('/auth/login?error=Account+not+associated+with+any+organisation')
}
