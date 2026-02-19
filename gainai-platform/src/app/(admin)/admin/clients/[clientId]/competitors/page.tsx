'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ArrowLeft,
  Plus,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Globe,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'

interface Competitor {
  id: string
  name: string
  category: string | null
  rating: number | null
  review_count: number | null
  website: string | null
  rating_trend: number | null
  created_at: string
}

interface ClientInfo {
  id: string
  name: string
}

export default function ClientCompetitorsPage({
  params,
}: {
  params: { clientId: string }
}) {
  const { clientId } = params
  const router = useRouter()
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // New competitor form state
  const [newCompetitor, setNewCompetitor] = useState({
    name: '',
    category: '',
    website: '',
  })

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [clientRes, competitorsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name')
          .eq('id', clientId)
          .single(),
        supabase
          .from('competitors')
          .select('*')
          .eq('client_id', clientId)
          .order('name', { ascending: true }),
      ])

      if (clientRes.data) setClient(clientRes.data)
      if (competitorsRes.data) setCompetitors(competitorsRes.data)

      setLoading(false)
    }

    fetchData()
  }, [clientId])

  async function handleAddCompetitor(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const supabase = createClient()

    const { data, error } = await supabase
      .from('competitors')
      .insert({
        client_id: clientId,
        name: newCompetitor.name,
        category: newCompetitor.category || null,
        website: newCompetitor.website || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to add competitor:', error)
      setSaving(false)
      return
    }

    setCompetitors((prev) => [...prev, data])
    setNewCompetitor({ name: '', category: '', website: '' })
    setDialogOpen(false)
    setSaving(false)
  }

  function renderTrendIndicator(trend: number | null) {
    if (trend === null || trend === 0) {
      return <Minus className="h-4 w-4 text-muted-foreground" />
    }
    if (trend > 0) {
      return (
        <div className="flex items-center gap-1 text-emerald-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-xs font-medium">+{trend.toFixed(1)}</span>
        </div>
      )
    }
    return (
      <div className="flex items-center gap-1 text-red-600">
        <TrendingDown className="h-4 w-4" />
        <span className="text-xs font-medium">{trend.toFixed(1)}</span>
      </div>
    )
  }

  const columns: ColumnDef<Competitor, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <span className="font-medium">{row.original.name}</span>
      ),
    },
    {
      accessorKey: 'category',
      header: 'Category',
      cell: ({ row }) => row.original.category || '-',
    },
    {
      accessorKey: 'rating',
      header: 'Rating',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>
            {row.original.rating !== null
              ? row.original.rating.toFixed(1)
              : '-'}
          </span>
          {row.original.rating !== null && (
            <span className="text-yellow-500">&#9733;</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'review_count',
      header: 'Reviews',
      cell: ({ row }) => row.original.review_count ?? '-',
    },
    {
      accessorKey: 'website',
      header: 'Website',
      cell: ({ row }) =>
        row.original.website ? (
          <a
            href={row.original.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline text-sm"
          >
            <Globe className="h-3.5 w-3.5" />
            Visit
          </a>
        ) : (
          '-'
        ),
    },
    {
      accessorKey: 'rating_trend',
      header: 'Trend',
      cell: ({ row }) => renderTrendIndicator(row.original.rating_trend),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/admin/clients/${clientId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Competitors</h1>
            <p className="text-muted-foreground">
              {client?.name || 'Loading...'} - Competitor Analysis
            </p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Competitor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Competitor</DialogTitle>
              <DialogDescription>
                Track a competitor for this client.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddCompetitor} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="comp-name">Business Name *</Label>
                <Input
                  id="comp-name"
                  required
                  value={newCompetitor.name}
                  onChange={(e) =>
                    setNewCompetitor((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder="e.g. Smith & Sons Plumbing"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comp-category">Category</Label>
                <Input
                  id="comp-category"
                  value={newCompetitor.category}
                  onChange={(e) =>
                    setNewCompetitor((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  placeholder="e.g. Plumber, Dentist"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comp-website">Website</Label>
                <Input
                  id="comp-website"
                  type="url"
                  value={newCompetitor.website}
                  onChange={(e) =>
                    setNewCompetitor((prev) => ({
                      ...prev,
                      website: e.target.value,
                    }))
                  }
                  placeholder="https://example.com"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add Competitor
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Competitors Table */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : competitors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No competitors tracked</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add competitors to compare ratings, reviews, and performance.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          columns={columns}
          data={competitors}
          searchKey="name"
          searchPlaceholder="Search competitors..."
          pageSize={15}
        />
      )}
    </div>
  )
}
