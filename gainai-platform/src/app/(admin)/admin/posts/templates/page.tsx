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
import { DataTable } from '@/components/shared/DataTable'
import { EmptyState } from '@/components/shared/EmptyState'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, FileText, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

interface PostTemplate {
  id: string
  name: string
  industry: string
  content_type: string
  title_template: string
  body_template: string
  cta_type: string | null
  tags: string[]
  created_at: string
}

const INDUSTRIES = [
  'General',
  'Restaurant',
  'Retail',
  'Healthcare',
  'Professional Services',
  'Automotive',
  'Beauty & Wellness',
  'Fitness',
  'Real Estate',
  'Home Services',
]

const CONTENT_TYPES = ['STANDARD', 'EVENT', 'OFFER', 'PRODUCT', 'ALERT']

const CTA_TYPES = ['BOOK', 'ORDER', 'SHOP', 'LEARN_MORE', 'SIGN_UP', 'CALL']

const emptyForm: Omit<PostTemplate, 'id' | 'created_at'> = {
  name: '',
  industry: 'General',
  content_type: 'STANDARD',
  title_template: '',
  body_template: '',
  cta_type: null,
  tags: [],
}

export default function PostTemplatesPage() {
  const [templates, setTemplates] = useState<PostTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [tagsInput, setTagsInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    const supabase = createClient()
    const { data } = await supabase
      .from('post_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) {
      setTemplates(
        data.map((t: any) => ({
          id: t.id,
          name: t.name ?? '',
          industry: t.industry ?? 'General',
          content_type: t.content_type ?? 'STANDARD',
          title_template: t.title_template ?? '',
          body_template: t.body_template ?? '',
          cta_type: t.cta_type,
          tags: t.tags ?? [],
          created_at: t.created_at,
        }))
      )
    }
    setLoading(false)
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setTagsInput('')
    setDialogOpen(true)
  }

  function openEdit(template: PostTemplate) {
    setEditingId(template.id)
    setForm({
      name: template.name,
      industry: template.industry,
      content_type: template.content_type,
      title_template: template.title_template,
      body_template: template.body_template,
      cta_type: template.cta_type,
      tags: template.tags,
    })
    setTagsInput(template.tags.join(', '))
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: form.name,
      industry: form.industry,
      content_type: form.content_type,
      title_template: form.title_template,
      body_template: form.body_template,
      cta_type: form.cta_type || null,
      tags: tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    }

    if (editingId) {
      await supabase.from('post_templates').update(payload).eq('id', editingId)
    } else {
      await supabase.from('post_templates').insert(payload)
    }

    setDialogOpen(false)
    setSaving(false)
    loadTemplates()
  }

  async function handleDelete() {
    if (!deleteId) return
    const supabase = createClient()
    await supabase.from('post_templates').delete().eq('id', deleteId)
    setDeleteId(null)
    loadTemplates()
  }

  const columns: ColumnDef<PostTemplate, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: 'industry',
      header: 'Industry',
    },
    {
      accessorKey: 'content_type',
      header: 'Content Type',
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.content_type?.toLowerCase().replace('_', ' ')}
        </Badge>
      ),
    },
    {
      accessorKey: 'body_template',
      header: 'Preview',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
          {row.original.body_template?.slice(0, 60) || '-'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-1 justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => openEdit(row.original)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDeleteId(row.original.id)}
          >
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
          <h1 className="text-2xl font-bold tracking-tight">Post Templates</h1>
          <p className="text-sm text-muted-foreground">
            Reusable templates for generating content
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Create Template
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description="Create your first post template to speed up content creation."
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
          data={templates}
          searchKey="name"
          searchPlaceholder="Search templates..."
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update this post template.'
                : 'Create a new reusable post template.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Weekly Special Offer"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Select
                  value={form.industry}
                  onValueChange={(v) => setForm({ ...form, industry: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INDUSTRIES.map((i) => (
                      <SelectItem key={i} value={i}>{i}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Content Type</Label>
                <Select
                  value={form.content_type}
                  onValueChange={(v) => setForm({ ...form, content_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((ct) => (
                      <SelectItem key={ct} value={ct}>
                        {ct.toLowerCase().replace('_', ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Title Template</Label>
              <Input
                value={form.title_template}
                onChange={(e) => setForm({ ...form, title_template: e.target.value })}
                placeholder="e.g. {{business_name}} Weekly Special"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Body Template</Label>
              <Textarea
                value={form.body_template}
                onChange={(e) => setForm({ ...form, body_template: e.target.value })}
                placeholder="e.g. This week at {{business_name}}, we're excited to offer..."
                rows={5}
              />
            </div>
            <div className="space-y-1.5">
              <Label>CTA Type</Label>
              <Select
                value={form.cta_type || 'none'}
                onValueChange={(v) => setForm({ ...form, cta_type: v === 'none' ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {CTA_TYPES.map((cta) => (
                    <SelectItem key={cta} value={cta}>
                      {cta.toLowerCase().replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tags (comma-separated)</Label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="e.g. weekly, offer, promotion"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
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
