'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Users, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

interface TeamMember {
  id: string
  full_name: string
  email: string
  role: string
  created_at: string
}

const ROLES = ['ADMIN', 'MANAGER', 'EDITOR', 'VIEWER']

const roleBadgeColor: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
  MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
  EDITOR: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  VIEWER: 'bg-gray-100 text-gray-800 border-gray-200',
}

export default function TeamSettingsPage() {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ full_name: '', email: '', role: 'EDITOR' })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadMembers()
  }, [])

  async function loadMembers() {
    const supabase = createClient()
    const { data } = await supabase
      .from('team_members')
      .select('id, full_name, email, role, created_at')
      .order('created_at', { ascending: true })

    if (data) {
      setMembers(
        data.map((m: any) => ({
          id: m.id,
          full_name: m.full_name ?? '',
          email: m.email ?? '',
          role: m.role ?? 'VIEWER',
          created_at: m.created_at,
        }))
      )
    }
    setLoading(false)
  }

  function openInvite() {
    setEditingId(null)
    setForm({ full_name: '', email: '', role: 'EDITOR' })
    setDialogOpen(true)
  }

  function openEdit(member: TeamMember) {
    setEditingId(member.id)
    setForm({
      full_name: member.full_name,
      email: member.email,
      role: member.role,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    if (editingId) {
      await supabase
        .from('team_members')
        .update({ full_name: form.full_name, role: form.role })
        .eq('id', editingId)
    } else {
      await supabase.from('team_members').insert({
        full_name: form.full_name,
        email: form.email,
        role: form.role,
      })
    }

    setDialogOpen(false)
    setSaving(false)
    loadMembers()
  }

  async function handleDelete() {
    if (!deleteId) return
    const supabase = createClient()
    await supabase.from('team_members').delete().eq('id', deleteId)
    setDeleteId(null)
    loadMembers()
  }

  const columns: ColumnDef<TeamMember, unknown>[] = [
    {
      accessorKey: 'full_name',
      header: 'Name',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            <span className="text-xs font-medium">
              {row.original.full_name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </span>
          </div>
          <span className="font-medium">{row.original.full_name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.email}</span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => (
        <Badge variant="outline" className={roleBadgeColor[row.original.role] || ''}>
          {row.original.role}
        </Badge>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Joined',
      cell: ({ row }) =>
        new Date(row.original.created_at).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button variant="ghost" size="icon" onClick={() => openEdit(row.original)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setDeleteId(row.original.id)}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Team Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage team members and their roles
          </p>
        </div>
        <Button onClick={openInvite}>
          <Plus className="h-4 w-4 mr-1" />
          Invite Team Member
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No team members"
          description="Invite your first team member to get started."
          action={
            <Button onClick={openInvite}>
              <Plus className="h-4 w-4 mr-1" />
              Invite Team Member
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={members}
          searchKey="full_name"
          searchPlaceholder="Search team members..."
        />
      )}

      {/* Invite/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Team Member' : 'Invite Team Member'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update this team member\'s details.'
                : 'Send an invitation to join your team.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Jane Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="jane@example.com"
                disabled={!!editingId}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Admin: Full access. Manager: Manage clients. Editor: Create content. Viewer: Read-only.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.full_name.trim() || (!editingId && !form.email.trim())}
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Remove Team Member"
        description="Are you sure you want to remove this team member? They will lose access to the platform."
        onConfirm={handleDelete}
        confirmText="Remove"
        destructive
      />
    </div>
  )
}
