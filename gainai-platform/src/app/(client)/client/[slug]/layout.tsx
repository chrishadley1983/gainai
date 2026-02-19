import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClientSidebar } from '@/components/client/ClientSidebar'

export default async function ClientLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Verify user is a client_user for this specific client (by slug)
  const { data: clientUser, error } = await supabase
    .from('client_users')
    .select(`
      id,
      name,
      role,
      clients!inner (
        id,
        name,
        slug
      )
    `)
    .eq('user_id', user.id)
    .eq('clients.slug', slug)
    .single()

  if (error || !clientUser) {
    redirect('/auth/login')
  }

  const clientData = clientUser.clients as unknown as {
    id: string
    name: string
    slug: string
  }

  const sidebarClient = {
    name: clientData.name,
    slug: clientData.slug,
  }

  const sidebarUser = {
    name: clientUser.name || user.email?.split('@')[0] || 'User',
    email: user.email || '',
    role: clientUser.role || 'viewer',
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <ClientSidebar client={sidebarClient} user={sidebarUser} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  )
}
