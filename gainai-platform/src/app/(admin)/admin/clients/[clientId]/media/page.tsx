'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Upload,
  Image as ImageIcon,
  Film,
  Filter,
  X,
  Loader2,
  Check,
  Cloud,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog'
import { formatDate } from '@/lib/utils/dates'

interface MediaItem {
  id: string
  url: string
  thumbnail_url: string | null
  mime_type: string
  file_name: string | null
  category: string
  google_media_id: string | null
  size_bytes: number | null
  width: number | null
  height: number | null
  created_at: string
}

interface ClientInfo {
  id: string
  name: string
}

const categoryLabels: Record<string, string> = {
  cover: 'Cover',
  profile: 'Profile',
  additional: 'Additional',
  post: 'Post',
}

export default function ClientMediaPage({
  params,
}: {
  params: { clientId: string }
}) {
  const { clientId } = params
  const router = useRouter()
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [media, setMedia] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [clientRes, mediaQuery] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name')
          .eq('id', clientId)
          .single(),
        (() => {
          let query = supabase
            .from('media')
            .select('*')
            .eq('client_id', clientId)
            .order('created_at', { ascending: false })

          if (categoryFilter !== 'all') {
            query = query.eq('category', categoryFilter)
          }

          if (typeFilter === 'image') {
            query = query.like('mime_type', 'image/%')
          } else if (typeFilter === 'video') {
            query = query.like('mime_type', 'video/%')
          }

          return query
        })(),
      ])

      if (clientRes.data) setClient(clientRes.data)
      if (mediaQuery.data) setMedia(mediaQuery.data)

      setLoading(false)
    }

    fetchData()
  }, [clientId, typeFilter, categoryFilter])

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleUpload(files)
    }
  }, [])

  async function handleUpload(files: File[]) {
    setUploading(true)
    // In a real implementation, upload files to Supabase Storage
    // then create media records
    console.log('Uploading files:', files.map((f) => f.name))
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setUploading(false)
    setUploadDialogOpen(false)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleUpload(files)
    }
  }

  function isImage(mimeType: string) {
    return mimeType.startsWith('image/')
  }

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
            <h1 className="text-3xl font-bold tracking-tight">Media</h1>
            <p className="text-muted-foreground">
              {client?.name || 'Loading...'} - Photos & Videos
            </p>
          </div>
        </div>
        <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Upload className="mr-2 h-4 w-4" />
              Upload
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upload Media</DialogTitle>
              <DialogDescription>
                Upload photos or videos for this client.
              </DialogDescription>
            </DialogHeader>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">
                    Drag and drop files here
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click below to select files
                  </p>
                  <label className="mt-4 inline-block">
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={handleFileInput}
                    />
                    <Button variant="outline" size="sm" asChild>
                      <span>Select Files</span>
                    </Button>
                  </label>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="image">Images</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="cover">Cover</SelectItem>
            <SelectItem value="profile">Profile</SelectItem>
            <SelectItem value="additional">Additional</SelectItem>
            <SelectItem value="post">Post</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Media Grid */}
      {loading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : media.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No media found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload photos or videos to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {media.map((item) => (
            <div
              key={item.id}
              className="group relative overflow-hidden rounded-lg border bg-muted aspect-square"
            >
              {isImage(item.mime_type) ? (
                <img
                  src={item.thumbnail_url || item.url}
                  alt={item.file_name || 'Media'}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Film className="h-12 w-12 text-muted-foreground" />
                </div>
              )}

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                <div className="flex justify-between items-start">
                  <Badge variant="secondary" className="text-xs">
                    {categoryLabels[item.category] || item.category}
                  </Badge>
                  {item.google_media_id ? (
                    <Badge variant="secondary" className="text-xs gap-1">
                      <Cloud className="h-3 w-3" />
                      Synced
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-white border-white/50">
                      Pending
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs text-white/80 truncate">
                    {item.file_name || 'Unnamed'}
                  </p>
                  <p className="text-xs text-white/60">
                    {formatDate(item.created_at, 'dd MMM yyyy')}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
