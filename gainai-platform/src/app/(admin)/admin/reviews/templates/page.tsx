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
import { Plus, MessageSquare, Pencil, Trash2 } from 'lucide-react'
import type { ColumnDef } from '@tanstack/react-table'

interface ReviewTemplate {
  id: string
  name: string
  min_stars: number
  max_stars: number
  sentiment: string | null
  template_body: string
  created_at: string
}

const emptyForm = {
  name: '',
  min_stars: 1,
  max_stars: 5,
  sentiment: '' as string | null,
  template_body: '',
}

export default function ReviewTemplatesPage() {
  const [templates, setTemplates] = useState<ReviewTemplate[]>([])
  const [loading, setLoading] = useState(true)
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
      .from('review_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (data) {
      setTemplates(
        data.map((t: any) => ({
          id: t.id,
          name: t.name ?? '',
          min_stars: t.min_stars ?? 1,
          max_stars: t.max_stars ?? 5,
          sentiment: t.sentiment,
          template_body: t.template_body ?? '',
          created_at: t.created_at,
        }))
      )
    }
    setLoading(false)
  }

  function openCreate() {
    setEditingId(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  function openEdit(template: ReviewTemplate) {
    setEditingId(template.id)
    setForm({
      name: template.name,
      min_stars: template.min_stars,
      max_stars: template.max_stars,
      sentiment: template.sentiment,
      template_body: template.template_body,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()

    const payload = {
      name: form.name,
      min_stars: form.min_stars,
      max_stars: form.max_stars,
      sentiment: form.sentiment || null,
      template_body: form.template_body,
    }

    if (editingId) {
      await supabase.from('review_templates').update(payload).eq('id', editingId)
    } else {
      await supabase.from('review_templates').insert(payload)
    }

    setDialogOpen(false)
    setSaving(false)
    loadTemplates()
  }

  async function handleDelete() {
    if (!deleteId) return
    const supabase = createClient()
    await supabase.from('review_templates').delete().eq('id', deleteId)
    setDeleteId(null)
    loadTemplates()
  }

  const columns: ColumnDef<ReviewTemplate, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      id: 'star_range',
      header: 'Star Range',
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.min_stars} - {row.original.max_stars} stars
        </span>
      ),
    },
    {
      accessorKey: 'sentiment',
      header: 'Sentiment',
      cell: ({ row }) =>
        row.original.sentiment ? (
          <Badge variant="outline" className="capitalize">
            {row.original.sentiment.toLowerCase()}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">Any</span>
        ),
    },
    {
      accessorKey: 'template_body',
      header: 'Preview',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-1 max-w-xs">
          {row.original.template_body?.slice(0, 60) || '-'}
        </span>
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
          <h1 className="text-2xl font-bold tracking-tight">Review Response Templates</h1>
          <p className="text-sm text-muted-foreground">
            Reusable templates for responding to reviews
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
          icon={MessageSquare}
          title="No templates yet"
          description="Create response templates to speed up review management."
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Template' : 'Create Template'}</DialogTitle>
            <DialogDescription>
              {editingId ? 'Update this review response template.' : 'Create a new review response template.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Positive 5-star response"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Min Stars</Label>
                <Select
                  value={form.min_stars.toString()}
                  onValueChange={(v) => setForm({ ...form, min_stars: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <SelectItem key={s} value={s.toString()}>{s} star{s > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Max Stars</Label>
                <Select
                  value={form.max_stars.toString()}
                  onValueChange={(v) => setForm({ ...form, max_stars: parseInt(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <SelectItem key={s} value={s.toString()}>{s} star{s > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Sentiment</Label>
              <Select
                value={form.sentiment || 'any'}
                onValueChange={(v) => setForm({ ...form, sentiment: v === 'any' ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="POSITIVE">Positive</SelectItem>
                  <SelectItem value="NEUTRAL">Neutral</SelectItem>
                  <SelectItem value="NEGATIVE">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Template Body</Label>
              <Textarea
                value={form.template_body}
                onChange={(e) => setForm({ ...form, template_body: e.target.value })}
                placeholder="Thank you for your review, {{reviewer_name}}! We're glad you enjoyed..."
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                Use {'{{reviewer_name}}'}, {'{{business_name}}'}, {'{{star_rating}}'} as placeholders.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.name.trim() || !form.template_body.trim()}>
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
