'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Check,
  X,
  Pencil,
  Calendar,
  ImageIcon,
  ExternalLink,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils/dates'
import { truncateText } from '@/lib/utils/formatting'

interface PendingPost {
  id: string
  title: string | null
  summary: string
  content_type: string
  scheduled_at: string | null
  media_urls: string[] | null
  cta_type: string | null
  cta_url: string | null
}

const contentTypeColors: Record<string, string> = {
  standard: 'bg-blue-100 text-blue-800',
  event: 'bg-purple-100 text-purple-800',
  offer: 'bg-orange-100 text-orange-800',
  product: 'bg-green-100 text-green-800',
  alert: 'bg-red-100 text-red-800',
}

export default function PendingPostsPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<PendingPost[]>([])
  const [editNotes, setEditNotes] = useState<Record<string, string>>({})
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [activeAction, setActiveAction] = useState<Record<string, 'edit' | 'reject' | null>>({})
  const [submitting, setSubmitting] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function loadPendingPosts() {
      setLoading(true)

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!client) {
        setLoading(false)
        return
      }

      const { data } = await supabase
        .from('posts')
        .select('id, title, summary, content_type, scheduled_at, media_urls, cta_type, cta_url')
        .eq('client_id', client.id)
        .eq('status', 'pending_review')
        .order('scheduled_at', { ascending: true })

      setPosts(data || [])
      setLoading(false)
    }

    loadPendingPosts()
  }, [slug, supabase])

  async function handleApprove(postId: string) {
    setSubmitting((prev) => ({ ...prev, [postId]: true }))

    await supabase
      .from('posts')
      .update({ status: 'approved' })
      .eq('id', postId)

    setPosts((prev) => prev.filter((p) => p.id !== postId))
    setSubmitting((prev) => ({ ...prev, [postId]: false }))
  }

  async function handleRequestEdit(postId: string) {
    const notes = editNotes[postId]
    if (!notes || !notes.trim()) return

    setSubmitting((prev) => ({ ...prev, [postId]: true }))

    await supabase
      .from('posts')
      .update({ status: 'revision_requested', revision_notes: notes.trim() })
      .eq('id', postId)

    setPosts((prev) => prev.filter((p) => p.id !== postId))
    setSubmitting((prev) => ({ ...prev, [postId]: false }))
  }

  async function handleReject(postId: string) {
    const reason = rejectReasons[postId]
    if (!reason || !reason.trim()) return

    setSubmitting((prev) => ({ ...prev, [postId]: true }))

    await supabase
      .from('posts')
      .update({ status: 'rejected', rejection_reason: reason.trim() })
      .eq('id', postId)

    setPosts((prev) => prev.filter((p) => p.id !== postId))
    setSubmitting((prev) => ({ ...prev, [postId]: false }))
  }

  function toggleAction(postId: string, action: 'edit' | 'reject') {
    setActiveAction((prev) => ({
      ...prev,
      [postId]: prev[postId] === action ? null : action,
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/client/${slug}/posts`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pending Approvals</h1>
          <p className="text-muted-foreground">
            Review and approve posts before they are published
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-xl" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Check}
          title="All caught up!"
          description="There are no posts waiting for your approval."
        />
      ) : (
        <div className="space-y-6">
          {posts.map((post) => (
            <Card key={post.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="grid md:grid-cols-2 gap-0">
                  {/* Google Business Profile post preview mock */}
                  <div className="bg-muted/30 p-6 border-b md:border-b-0 md:border-r">
                    <p className="text-xs font-medium text-muted-foreground mb-3">
                      Google Business Profile Preview
                    </p>
                    <div className="rounded-lg border bg-background shadow-sm overflow-hidden">
                      {/* Photo area */}
                      <div className="h-40 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                        {post.media_urls && post.media_urls.length > 0 ? (
                          <img
                            src={post.media_urls[0]}
                            alt="Post media"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="p-4 space-y-3">
                        {post.title && (
                          <p className="font-semibold text-sm">{post.title}</p>
                        )}
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {truncateText(post.summary, 200)}
                        </p>

                        {/* CTA button */}
                        {post.cta_type && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            disabled
                          >
                            {post.cta_type.replace(/_/g, ' ')}
                            <ExternalLink className="h-3.5 w-3.5 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Details and actions */}
                  <div className="p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge
                        className={cn(
                          contentTypeColors[post.content_type.toLowerCase()] ||
                            'bg-gray-100 text-gray-800'
                        )}
                      >
                        {post.content_type}
                      </Badge>
                      {post.scheduled_at && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          {formatDate(post.scheduled_at, 'dd MMM yyyy HH:mm')}
                        </div>
                      )}
                    </div>

                    {post.title && (
                      <h3 className="text-lg font-semibold">{post.title}</h3>
                    )}

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {post.summary}
                    </p>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => handleApprove(post.id)}
                        disabled={submitting[post.id]}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="outline"
                        className="border-amber-300 text-amber-700 hover:bg-amber-50"
                        onClick={() => toggleAction(post.id, 'edit')}
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        Request Edit
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => toggleAction(post.id, 'reject')}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                    </div>

                    {/* Edit notes textarea */}
                    {activeAction[post.id] === 'edit' && (
                      <div className="space-y-2 pt-2">
                        <Textarea
                          placeholder="Describe the changes you'd like..."
                          value={editNotes[post.id] || ''}
                          onChange={(e) =>
                            setEditNotes((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          className="border-amber-300 bg-amber-500 hover:bg-amber-600 text-white"
                          onClick={() => handleRequestEdit(post.id)}
                          disabled={!editNotes[post.id]?.trim() || submitting[post.id]}
                        >
                          Send Edit Request
                        </Button>
                      </div>
                    )}

                    {/* Reject reason textarea */}
                    {activeAction[post.id] === 'reject' && (
                      <div className="space-y-2 pt-2">
                        <Textarea
                          placeholder="Please provide a reason for rejection (required)..."
                          value={rejectReasons[post.id] || ''}
                          onChange={(e) =>
                            setRejectReasons((prev) => ({
                              ...prev,
                              [post.id]: e.target.value,
                            }))
                          }
                        />
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleReject(post.id)}
                          disabled={!rejectReasons[post.id]?.trim() || submitting[post.id]}
                        >
                          Confirm Rejection
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
