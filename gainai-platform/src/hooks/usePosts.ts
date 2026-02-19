'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PostStatus, ContentType } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PostRow {
  id: string
  location_id: string
  client_id: string
  google_post_id: string | null
  content_type: ContentType
  status: PostStatus
  title: string | null
  body: string | null
  call_to_action: Record<string, unknown> | null
  media_urls: string[] | null
  scheduled_for: string | null
  published_at: string | null
  failure_reason: string | null
  created_by_id: string | null
  created_at: string
  updated_at: string
}

export interface PostFilters {
  clientId?: string
  status?: PostStatus
  locationId?: string
}

export interface CreatePostInput {
  location_id: string
  client_id: string
  content_type: ContentType
  status?: PostStatus
  title?: string
  body?: string
  call_to_action?: Record<string, unknown>
  media_urls?: string[]
  scheduled_for?: string
}

export interface UpdatePostInput {
  status?: PostStatus
  title?: string | null
  body?: string | null
  content_type?: ContentType
  call_to_action?: Record<string, unknown> | null
  media_urls?: string[] | null
  scheduled_for?: string | null
  published_at?: string | null
  failure_reason?: string | null
}

// ---------------------------------------------------------------------------
// usePosts – fetch posts with optional filters
// ---------------------------------------------------------------------------

export function usePosts(filters?: PostFilters) {
  const [posts, setPosts] = useState<PostRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPosts = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      let query = supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId)
      }

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.locationId) {
        query = query.eq('location_id', filters.locationId)
      }

      const { data, error: queryError } = await query

      if (queryError) {
        throw new Error(queryError.message)
      }

      setPosts((data as PostRow[]) ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch posts'
      setError(message)
      console.error('[usePosts]', message)
    } finally {
      setLoading(false)
    }
  }, [filters?.clientId, filters?.status, filters?.locationId])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  return { posts, loading, error, refetch: fetchPosts }
}

// ---------------------------------------------------------------------------
// usePost – fetch a single post by ID
// ---------------------------------------------------------------------------

export function usePost(postId: string | undefined) {
  const [post, setPost] = useState<PostRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPost = useCallback(async () => {
    if (!postId) {
      setPost(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: queryError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single()

      if (queryError) {
        throw new Error(queryError.message)
      }

      setPost(data as PostRow)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch post'
      setError(message)
      console.error('[usePost]', message)
    } finally {
      setLoading(false)
    }
  }, [postId])

  useEffect(() => {
    fetchPost()
  }, [fetchPost])

  return { post, loading, error, refetch: fetchPost }
}

// ---------------------------------------------------------------------------
// useCreatePost – mutation to create a new post
// ---------------------------------------------------------------------------

export function useCreatePost() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createPost = useCallback(async (input: CreatePostInput): Promise<PostRow | null> => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: insertError } = await supabase
        .from('posts')
        .insert({
          ...input,
          status: input.status ?? 'DRAFT',
        })
        .select()
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      return data as PostRow
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create post'
      setError(message)
      console.error('[useCreatePost]', message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { createPost, loading, error }
}

// ---------------------------------------------------------------------------
// useUpdatePost – mutation to update a post
// ---------------------------------------------------------------------------

export function useUpdatePost() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updatePost = useCallback(async (
    postId: string,
    input: UpdatePostInput
  ): Promise<PostRow | null> => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: updateError } = await supabase
        .from('posts')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', postId)
        .select()
        .single()

      if (updateError) {
        throw new Error(updateError.message)
      }

      return data as PostRow
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update post'
      setError(message)
      console.error('[useUpdatePost]', message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { updatePost, loading, error }
}
