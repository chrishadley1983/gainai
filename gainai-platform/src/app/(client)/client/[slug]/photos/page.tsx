'use client'

import { useEffect, useState } from 'react'
import {
  ImageIcon,
  CheckCircle,
  Clock,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { EmptyState } from '@/components/shared/EmptyState'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDate } from '@/lib/utils/dates'

interface MediaItem {
  id: string
  storage_url: string
  google_url: string | null
  file_name: string | null
  category: string
  media_type: string
  created_at: string
  status: string | null
}

const categoryLabels: Record<string, string> = {
  COVER: 'Cover',
  PROFILE: 'Profile',
  ADDITIONAL: 'Additional',
  POST: 'Post',
  INTERIOR: 'Interior',
  EXTERIOR: 'Exterior',
  PRODUCT: 'Product',
  TEAM: 'Team',
}

const categoryColors: Record<string, string> = {
  COVER: 'bg-purple-100 text-purple-800',
  PROFILE: 'bg-blue-100 text-blue-800',
  ADDITIONAL: 'bg-gray-100 text-gray-800',
  POST: 'bg-green-100 text-green-800',
  INTERIOR: 'bg-amber-100 text-amber-800',
  EXTERIOR: 'bg-emerald-100 text-emerald-800',
  PRODUCT: 'bg-orange-100 text-orange-800',
  TEAM: 'bg-pink-100 text-pink-800',
}

export default function PhotosPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [photos, setPhotos] = useState<MediaItem[]>([])
  const [clientId, setClientId] = useState<string | null>(null)
  const [locationId, setLocationId] = useState<string | null>(null)
  const [uploadCategory, setUploadCategory] = useState('ADDITIONAL')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState(false)

  useEffect(() => {
    async function loadPhotos() {
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

      setClientId(client.id)

      const { data: location } = await supabase
        .from('gbp_locations')
        .select('id')
        .eq('client_id', client.id)
        .limit(1)
        .single()

      if (location) {
        setLocationId(location.id)
      }

      const { data } = await supabase
        .from('gbp_media')
        .select('id, storage_url, google_url, file_name, category, media_type, created_at, status')
        .eq('client_id', client.id)
        .order('created_at', { ascending: false })

      setPhotos(data || [])
      setLoading(false)
    }

    loadPhotos()
  }, [slug, supabase])

  async function handleFileDrop(files: File[]) {
    if (!clientId || !locationId || files.length === 0) return

    const file = files[0]
    setUploadError(null)
    setUploadSuccess(false)

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png']
    if (!validTypes.includes(file.type)) {
      setUploadError('Only JPEG and PNG files are accepted.')
      return
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setUploadError('File must be smaller than 5MB.')
      return
    }

    setUploading(true)

    try {
      const fileExt = file.name.split('.').pop() || 'jpg'
      const fileName = `${locationId}/${Date.now()}.${fileExt}`
      const storagePath = `gbp-media/${fileName}`

      // Upload to Supabase Storage
      const { error: storageError } = await supabase.storage
        .from('media')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        })

      if (storageError) {
        setUploadError('Failed to upload file. Please try again.')
        setUploading(false)
        return
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('media')
        .getPublicUrl(storagePath)

      // Create media record
      const { data: mediaRecord, error: mediaError } = await supabase
        .from('gbp_media')
        .insert({
          location_id: locationId,
          client_id: clientId,
          media_type: 'PHOTO',
          category: uploadCategory,
          storage_path: storagePath,
          storage_url: publicUrlData.publicUrl,
          file_name: file.name,
          file_size: file.size,
          mime_type: file.type,
          status: 'pending',
        })
        .select()
        .single()

      if (mediaError) {
        setUploadError('File uploaded but failed to create record.')
        setUploading(false)
        return
      }

      // Add to photos list
      setPhotos((prev) => [mediaRecord, ...prev])
      setUploadSuccess(true)
      setTimeout(() => setUploadSuccess(false), 3000)
    } catch {
      setUploadError('An unexpected error occurred.')
    }

    setUploading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Photos</h1>
        <p className="text-muted-foreground">
          Manage your Google Business Profile photos
        </p>
      </div>

      {/* Upload zone */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Photo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-48">
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADDITIONAL">Additional</SelectItem>
                  <SelectItem value="INTERIOR">Interior</SelectItem>
                  <SelectItem value="EXTERIOR">Exterior</SelectItem>
                  <SelectItem value="PRODUCT">Product</SelectItem>
                  <SelectItem value="TEAM">Team</SelectItem>
                  <SelectItem value="COVER">Cover</SelectItem>
                  <SelectItem value="PROFILE">Profile</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </div>
            )}
          </div>

          <FileDropzone
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            maxSize={5 * 1024 * 1024}
            onDrop={handleFileDrop}
            multiple={false}
          />

          {uploadError && (
            <p className="text-sm text-red-500">{uploadError}</p>
          )}

          {uploadSuccess && (
            <p className="text-sm text-emerald-600">
              Photo uploaded successfully!
            </p>
          )}
        </CardContent>
      </Card>

      {/* Photo gallery */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      ) : photos.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No photos yet"
          description="Upload photos to showcase your business on Google."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-square rounded-lg overflow-hidden border bg-muted"
            >
              <img
                src={photo.storage_url}
                alt={photo.file_name || 'Business photo'}
                className="h-full w-full object-cover"
              />

              {/* Overlay on hover */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                <div className="flex items-center justify-between">
                  <Badge
                    className={cn(
                      'text-[10px]',
                      categoryColors[photo.category] || 'bg-gray-100 text-gray-800'
                    )}
                  >
                    {categoryLabels[photo.category] || photo.category}
                  </Badge>
                  {photo.google_url || photo.status === 'published' ? (
                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Clock className="h-4 w-4 text-amber-400" />
                  )}
                </div>
                <div>
                  <p className="text-[10px] text-white/70 truncate">
                    {photo.file_name}
                  </p>
                  <p className="text-[10px] text-white/50">
                    {formatDate(photo.created_at, 'dd MMM yyyy')}
                  </p>
                </div>
              </div>

              {/* Status indicator (always visible) */}
              <div className="absolute top-2 right-2">
                {photo.google_url || photo.status === 'published' ? (
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
                ) : (
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
