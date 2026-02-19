import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  // Verify the user is a team member
  const { data: teamMember, error } = await supabase
    .from('team_members')
    .select('id, name, role')
    .eq('user_id', user.id)
    .single()

  if (error || !teamMember) {
    redirect('/auth/login')
  }

  const sidebarUser = {
    name: teamMember.name || user.email?.split('@')[0] || 'Admin',
    email: user.email || '',
    role: teamMember.role || 'member',
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar user={sidebarUser} />
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 md:p-8">{children}</div>
      </main>
    </div>
  )
}
