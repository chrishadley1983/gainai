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
  Eye,
  MousePointerClick,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate } from '@/lib/utils/dates'

interface PostDetail {
  id: string
  title: string | null
  summary: string
  content_type: string
  status: string
  scheduled_at: string | null
  published_at: string | null
  created_at: string
  media_urls: string[] | null
  cta_type: string | null
  cta_url: string | null
  views: number | null
  clicks: number | null
  rejection_reason: string | null
  revision_notes: string | null
}

const contentTypeColors: Record<string, string> = {
  standard: 'bg-blue-100 text-blue-800',
  event: 'bg-purple-100 text-purple-800',
  offer: 'bg-orange-100 text-orange-800',
  product: 'bg-green-100 text-green-800',
  alert: 'bg-red-100 text-red-800',
}

export default function PostDetailPage({
  params,
}: {
  params: { slug: string; postId: string }
}) {
  const { slug, postId } = params
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [post, setPost] = useState<PostDetail | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [activeAction, setActiveAction] = useState<'edit' | 'reject' | null>(null)
  const [editNotes, setEditNotes] = useState('')
  const [rejectReason, setRejectReason] = useState('')

  useEffect(() => {
    async function loadPost() {
      setLoading(true)

      const { data } = await supabase
        .from('posts')
        .select(
          'id, title, summary, content_type, status, scheduled_at, published_at, created_at, media_urls, cta_type, cta_url, views, clicks, rejection_reason, revision_notes'
        )
        .eq('id', postId)
        .single()

      setPost(data)
      setLoading(false)
    }

    loadPost()
  }, [postId, supabase])

  async function handleApprove() {
    if (!post) return
    setSubmitting(true)

    await supabase
      .from('posts')
      .update({ status: 'approved' })
      .eq('id', post.id)

    setPost((prev) => (prev ? { ...prev, status: 'approved' } : prev))
    setSubmitting(false)
  }

  async function handleRequestEdit() {
    if (!post || !editNotes.trim()) return
    setSubmitting(true)

    await supabase
      .from('posts')
      .update({ status: 'revision_requested', revision_notes: editNotes.trim() })
      .eq('id', post.id)

    setPost((prev) =>
      prev ? { ...prev, status: 'revision_requested', revision_notes: editNotes.trim() } : prev
    )
    setActiveAction(null)
    setSubmitting(false)
  }

  async function handleReject() {
    if (!post || !rejectReason.trim()) return
    setSubmitting(true)

    await supabase
      .from('posts')
      .update({ status: 'rejected', rejection_reason: rejectReason.trim() })
      .eq('id', post.id)

    setPost((prev) =>
      prev ? { ...prev, status: 'rejected', rejection_reason: rejectReason.trim() } : prev
    )
    setActiveAction(null)
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/client/${slug}/posts`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Post not found</h1>
        </div>
      </div>
    )
  }

  const isPending = post.status === 'pending_review'
  const isPublished = post.status === 'published'

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/client/${slug}/posts`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {post.title || 'Post Detail'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge
              className={cn(
                contentTypeColors[post.content_type.toLowerCase()] ||
                  'bg-gray-100 text-gray-800'
              )}
            >
              {post.content_type}
            </Badge>
            <StatusBadge status={post.status} />
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Google preview mock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Google Business Profile Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border shadow-sm overflow-hidden">
              {/* Photo area */}
              <div className="h-48 bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                {post.media_urls && post.media_urls.length > 0 ? (
                  <img
                    src={post.media_urls[0]}
                    alt="Post media"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon className="h-12 w-12 text-muted-foreground/40" />
                )}
              </div>

              <div className="p-4 space-y-3">
                {post.title && (
                  <p className="font-semibold">{post.title}</p>
                )}
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {post.summary}
                </p>

                {post.cta_type && (
                  <Button variant="outline" size="sm" className="w-full" disabled>
                    {post.cta_type.replace(/_/g, ' ')}
                    <ExternalLink className="h-3.5 w-3.5 ml-1" />
                  </Button>
                )}
              </div>

              {post.media_urls && post.media_urls.length > 1 && (
                <div className="px-4 pb-4 flex gap-2 overflow-x-auto">
                  {post.media_urls.slice(1).map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      alt={`Media ${i + 2}`}
                      className="h-16 w-16 rounded object-cover shrink-0"
                    />
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Details panel */}
        <div className="space-y-6">
          {/* Dates and status */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={post.status} />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(post.created_at, 'dd MMM yyyy HH:mm')}</span>
              </div>
              {post.scheduled_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Scheduled</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(post.scheduled_at, 'dd MMM yyyy HH:mm')}
                  </span>
                </div>
              )}
              {post.published_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Published</span>
                  <span>{formatDate(post.published_at, 'dd MMM yyyy HH:mm')}</span>
                </div>
              )}
              {post.rejection_reason && (
                <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800">
                  <p className="font-medium mb-1">Rejection Reason:</p>
                  <p>{post.rejection_reason}</p>
                </div>
              )}
              {post.revision_notes && (
                <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  <p className="font-medium mb-1">Edit Requested:</p>
                  <p>{post.revision_notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance stats (if published) */}
          {isPublished && (
            <Card>
              <CardHeader>
                <CardTitle>Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4 text-center">
                    <Eye className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-2xl font-bold">{post.views ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Views</p>
                  </div>
                  <div className="rounded-lg border p-4 text-center">
                    <MousePointerClick className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-2xl font-bold">{post.clicks ?? 0}</p>
                    <p className="text-xs text-muted-foreground">Clicks</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Approval buttons (if pending) */}
          {isPending && (
            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={handleApprove}
                    disabled={submitting}
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="border-amber-300 text-amber-700 hover:bg-amber-50"
                    onClick={() =>
                      setActiveAction(activeAction === 'edit' ? null : 'edit')
                    }
                  >
                    <Pencil className="h-4 w-4 mr-1" />
                    Request Edit
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() =>
                      setActiveAction(activeAction === 'reject' ? null : 'reject')
                    }
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>

                {activeAction === 'edit' && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Describe the changes you'd like..."
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                    />
                    <Button
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={handleRequestEdit}
                      disabled={!editNotes.trim() || submitting}
                    >
                      Send Edit Request
                    </Button>
                  </div>
                )}

                {activeAction === 'reject' && (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Provide a reason for rejection (required)..."
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={handleReject}
                      disabled={!rejectReason.trim() || submitting}
                    >
                      Confirm Rejection
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
