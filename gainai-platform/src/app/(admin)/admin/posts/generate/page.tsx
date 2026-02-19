'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/shared/StatusBadge'
import {
  Sparkles,
  Loader2,
  Check,
  CheckCheck,
  X,
} from 'lucide-react'

interface ClientOption {
  id: string
  name: string
  slug: string
}

interface GeneratedPost {
  id: string
  client_id: string
  client_name: string
  content_type: string
  title: string
  body: string
  approved: boolean
  scheduled_date: string | null
}

const CONTENT_TYPES = [
  { key: 'STANDARD', label: 'Standard' },
  { key: 'EVENT', label: 'Event' },
  { key: 'OFFER', label: 'Offer' },
  { key: 'PRODUCT', label: 'Product' },
  { key: 'ALERT', label: 'Alert' },
]

export default function PostsGeneratePage() {
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [postCount, setPostCount] = useState(5)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['STANDARD', 'OFFER'])
  const [generating, setGenerating] = useState(false)
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([])
  const [scheduling, setScheduling] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('clients')
        .select('id, name, slug')
        .eq('status', 'ACTIVE')
        .order('name')

      if (data) {
        setClients(data.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })))
      }
      setLoading(false)
    }
    load()
  }, [])

  function toggleClient(clientId: string) {
    setSelectedClients((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    )
  }

  function toggleAllClients() {
    if (selectedClients.length === clients.length) {
      setSelectedClients([])
    } else {
      setSelectedClients(clients.map((c) => c.id))
    }
  }

  function toggleContentType(type: string) {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    )
  }

  async function handleGenerate() {
    setGenerating(true)
    setGeneratedPosts([])

    // Simulate AI generation (in production this would call an API endpoint)
    await new Promise((resolve) => setTimeout(resolve, 2500))

    const mockPosts: GeneratedPost[] = []
    let counter = 0

    for (const clientId of selectedClients) {
      const client = clients.find((c) => c.id === clientId)
      if (!client) continue

      for (let i = 0; i < postCount; i++) {
        const typeIdx = i % selectedTypes.length
        counter++
        mockPosts.push({
          id: `gen-${counter}`,
          client_id: clientId,
          client_name: client.name,
          content_type: selectedTypes[typeIdx],
          title: `${client.name} - ${selectedTypes[typeIdx].toLowerCase()} post ${i + 1}`,
          body: `AI-generated content for ${client.name}. This is a ${selectedTypes[typeIdx].toLowerCase()} post that would be customised based on the client's industry, location, and brand voice. The content would include relevant keywords and calls to action.`,
          approved: false,
          scheduled_date: dateFrom
            ? new Date(
                new Date(dateFrom).getTime() +
                  Math.random() *
                    (dateTo
                      ? new Date(dateTo).getTime() - new Date(dateFrom).getTime()
                      : 7 * 24 * 60 * 60 * 1000)
              ).toISOString()
            : null,
        })
      }
    }

    setGeneratedPosts(mockPosts)
    setGenerating(false)
  }

  function toggleApproval(postId: string) {
    setGeneratedPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, approved: !p.approved } : p))
    )
  }

  function approveAll() {
    setGeneratedPosts((prev) => prev.map((p) => ({ ...p, approved: true })))
  }

  function removePost(postId: string) {
    setGeneratedPosts((prev) => prev.filter((p) => p.id !== postId))
  }

  async function handleSchedule() {
    setScheduling(true)
    const approved = generatedPosts.filter((p) => p.approved)

    const supabase = createClient()

    const inserts = approved.map((p) => ({
      client_id: p.client_id,
      content_type: p.content_type,
      title: p.title,
      summary: p.body,
      status: p.scheduled_date ? 'SCHEDULED' : 'DRAFT',
      scheduled_at: p.scheduled_date,
    }))

    if (inserts.length > 0) {
      await supabase.from('posts').insert(inserts)
    }

    setGeneratedPosts((prev) => prev.filter((p) => !p.approved))
    setScheduling(false)
  }

  const approvedCount = generatedPosts.filter((p) => p.approved).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">AI Content Generation</h1>
        <p className="text-sm text-muted-foreground">
          Generate posts for multiple clients at once using AI
        </p>
      </div>

      {generatedPosts.length === 0 ? (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Client selection */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">Select Clients</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedClients.length === clients.length && clients.length > 0}
                      onCheckedChange={toggleAllClients}
                    />
                    <Label className="text-sm font-medium cursor-pointer" onClick={toggleAllClients}>
                      Select All ({clients.length})
                    </Label>
                  </div>
                  <div className="border-t pt-2 space-y-2 max-h-64 overflow-y-auto">
                    {clients.map((client) => (
                      <div key={client.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={selectedClients.includes(client.id)}
                          onCheckedChange={() => toggleClient(client.id)}
                        />
                        <Label className="text-sm cursor-pointer" onClick={() => toggleClient(client.id)}>
                          {client.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                  {clients.length === 0 && (
                    <p className="text-sm text-muted-foreground">No active clients found.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1.5">
                <Label>Number of posts per client</Label>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={postCount}
                  onChange={(e) => setPostCount(parseInt(e.target.value) || 1)}
                  className="max-w-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Date From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Date To</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Content Types</Label>
                <div className="flex flex-wrap gap-3">
                  {CONTENT_TYPES.map((ct) => (
                    <div key={ct.key} className="flex items-center gap-2">
                      <Checkbox
                        checked={selectedTypes.includes(ct.key)}
                        onCheckedChange={() => toggleContentType(ct.key)}
                      />
                      <Label className="text-sm cursor-pointer" onClick={() => toggleContentType(ct.key)}>
                        {ct.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <Button
                  size="lg"
                  onClick={handleGenerate}
                  disabled={
                    generating ||
                    selectedClients.length === 0 ||
                    selectedTypes.length === 0
                  }
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate {selectedClients.length * postCount} Posts
                    </>
                  )}
                </Button>
                {selectedClients.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Select at least one client to generate content.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        /* Generated posts preview */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">
                Generated Posts ({generatedPosts.length})
              </h2>
              <p className="text-sm text-muted-foreground">
                {approvedCount} of {generatedPosts.length} approved
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setGeneratedPosts([])}>
                Start Over
              </Button>
              <Button variant="outline" onClick={approveAll}>
                <CheckCheck className="h-4 w-4 mr-1" />
                Approve All
              </Button>
              <Button
                onClick={handleSchedule}
                disabled={scheduling || approvedCount === 0}
              >
                {scheduling ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Scheduling...
                  </>
                ) : (
                  <>Schedule {approvedCount} Approved Posts</>
                )}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {generatedPosts.map((post) => (
              <Card
                key={post.id}
                className={cn(
                  'transition-colors',
                  post.approved && 'border-emerald-300 bg-emerald-50/50'
                )}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">
                        {post.client_name}
                      </p>
                      <p className="text-sm font-medium">{post.title}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() => removePost(post.id)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">
                    {post.body}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs capitalize">
                        {post.content_type.toLowerCase().replace('_', ' ')}
                      </Badge>
                      {post.scheduled_date && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(post.scheduled_date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      )}
                    </div>
                    <Button
                      variant={post.approved ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleApproval(post.id)}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      {post.approved ? 'Approved' : 'Approve'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
