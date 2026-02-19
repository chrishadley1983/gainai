'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, FileText, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

interface TemplateRow {
  id: string
  category: string
  name: string
  subject: string | null
  body: string
  variables: string[]
  created_at: string
}

const CATEGORIES = [
  { key: 'post', label: 'Post Templates' },
  { key: 'review', label: 'Review Templates' },
  { key: 'email', label: 'Email Templates' },
  { key: 'report', label: 'Report Templates' },
]

const emptyForm = {
  category: 'post',
  name: '',
  subject: '',
  body: '',
  variables: '',
}

export default function GlobalTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('post')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    const supabase = createClient()
    const { data } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) {
      setTemplates(
        data.map((t: any) => ({
          id: t.id,
          category: t.category ?? 'post',
          name: t.name ?? '',
          subject: t.subject,
          body: t.body ?? '',
          variables: t.variables ?? [],
          created_at: t.created_at,
        }))
      )
    }
    setLoading(false)
  }

  function openCreate() {
    setEditingId(null)
    setForm({ ...emptyForm, category: activeTab })
    setDialogOpen(true)
  }

  function openEdit(template: TemplateRow) {
    setEditingId(template.id)
    setForm({
      category: template.category,
      name: template.name,
      subject: template.subject || '',
      body: template.body,
      variables: template.variables.join(', '),
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    const payload = {
      category: form.category,
      name: form.name,
      subject: form.subject || null,
      body: form.body,
      variables: form.variables
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    }

    if (editingId) {
      await supabase.from('templates').update(payload).eq('id', editingId)
    } else {
      await supabase.from('templates').insert(payload)
    }

    setDialogOpen(false)
    setSaving(false)
    loadTemplates()
  }

  async function handleDelete() {
    if (!deleteId) return
    const supabase = createClient()
    await supabase.from('templates').delete().eq('id', deleteId)
    setDeleteId(null)
    loadTemplates()
  }

  function getFilteredTemplates(category: string) {
    return templates.filter((t) => t.category === category)
  }

  const columns: ColumnDef<TemplateRow, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    ...(activeTab === 'email'
      ? [
          {
            accessorKey: 'subject' as const,
            header: 'Subject',
            cell: ({ row }: any) => (
              <span className="text-sm text-muted-foreground">
                {row.original.subject || '-'}
              </span>
            ),
          } as ColumnDef<TemplateRow, unknown>,
        ]
      : []),
    {
      accessorKey: 'body',
      header: 'Preview',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
          {row.original.body?.slice(0, 60) || '-'}
        </span>
      ),
    },
    {
      id: 'variables',
      header: 'Variables',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.variables.slice(0, 3).map((v) => (
            <Badge key={v} variant="outline" className="text-[10px]">
              {`{{${v}}}`}
            </Badge>
          ))}
          {row.original.variables.length > 3 && (
            <Badge variant="outline" className="text-[10px]">
              +{row.original.variables.length - 3}
            </Badge>
          )}
        </div>
      ),
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
          <h1 className="text-2xl font-bold tracking-tight">Global Templates</h1>
          <p className="text-sm text-muted-foreground">
            Manage templates for posts, reviews, emails, and reports
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Create Template
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {CATEGORIES.map((cat) => (
            <TabsTrigger key={cat.key} value={cat.key}>
              {cat.label}
              <Badge variant="outline" className="ml-2 text-[10px] h-4 px-1">
                {getFilteredTemplates(cat.key).length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((cat) => (
          <TabsContent key={cat.key} value={cat.key}>
            {loading ? (
              <div className="space-y-3 mt-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : getFilteredTemplates(cat.key).length === 0 ? (
              <EmptyState
                icon={FileText}
                title={`No ${cat.label.toLowerCase()}`}
                description={`Create your first ${cat.key} template.`}
                action={
                  <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create Template
                  </Button>
                }
              />
            ) : (
              <DataTable
                columns={columns}
                data={getFilteredTemplates(cat.key)}
                searchKey="name"
                searchPlaceholder="Search templates..."
              />
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update this global template.'
                : 'Create a new global template.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.key} value={cat.key}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Welcome Email"
              />
            </div>
            {(form.category === 'email' || form.category === 'report') && (
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="e.g. Your Monthly Report for {{month}}"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Template content with {{variable}} placeholders..."
                rows={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Variables (comma-separated)</Label>
              <Input
                value={form.variables}
                onChange={(e) => setForm({ ...form, variables: e.target.value })}
                placeholder="e.g. business_name, month, year"
              />
              <p className="text-xs text-muted-foreground">
                Define placeholder variables used in the template body.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || !form.body.trim()}
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={() => setDeleteId(null)}
        title="Delete Template"
        description="Are you sure you want to delete this template? This action cannot be undone."
        onConfirm={handleDelete}
        confirmText="Delete"
        destructive
      />
    </div>
  )
}
