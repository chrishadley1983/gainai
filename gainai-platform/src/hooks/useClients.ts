'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ClientStatus } from '@/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientRow {
  id: string
  organisation_id: string
  name: string
  slug: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  industry: string | null
  address: Record<string, unknown> | null
  website: string | null
  package: string | null
  monthly_fee: number | null
  status: ClientStatus
  brand_voice: Record<string, unknown> | null
  notes: string | null
  tags: string[] | null
  created_at: string
  updated_at: string
}

export interface ClientFilters {
  status?: ClientStatus
  search?: string
}

export interface CreateClientInput {
  organisation_id: string
  name: string
  slug: string
  contact_name?: string
  contact_email?: string
  contact_phone?: string
  industry?: string
  address?: Record<string, unknown>
  website?: string
  package?: string
  monthly_fee?: number
  status?: ClientStatus
  brand_voice?: Record<string, unknown>
  notes?: string
  tags?: string[]
}

export interface UpdateClientInput {
  name?: string
  slug?: string
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
  industry?: string | null
  address?: Record<string, unknown> | null
  website?: string | null
  package?: string | null
  monthly_fee?: number | null
  status?: ClientStatus
  brand_voice?: Record<string, unknown> | null
  notes?: string | null
  tags?: string[] | null
}

// ---------------------------------------------------------------------------
// useClients – fetch a list of clients with optional filters
// ---------------------------------------------------------------------------

export function useClients(filters?: ClientFilters) {
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      let query = supabase
        .from('clients')
        .select('*')
        .order('name', { ascending: true })

      if (filters?.status) {
        query = query.eq('status', filters.status)
      }

      if (filters?.search) {
        query = query.or(
          `name.ilike.%${filters.search}%,contact_name.ilike.%${filters.search}%,contact_email.ilike.%${filters.search}%`
        )
      }

      const { data, error: queryError } = await query

      if (queryError) {
        throw new Error(queryError.message)
      }

      setClients((data as ClientRow[]) ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch clients'
      setError(message)
      console.error('[useClients]', message)
    } finally {
      setLoading(false)
    }
  }, [filters?.status, filters?.search])

  useEffect(() => {
    fetchClients()
  }, [fetchClients])

  return { clients, loading, error, refetch: fetchClients }
}

// ---------------------------------------------------------------------------
// useClient – fetch a single client by ID
// ---------------------------------------------------------------------------

export function useClient(clientId: string | undefined) {
  const [client, setClient] = useState<ClientRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchClient = useCallback(async () => {
    if (!clientId) {
      setClient(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: queryError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single()

      if (queryError) {
        throw new Error(queryError.message)
      }

      setClient(data as ClientRow)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch client'
      setError(message)
      console.error('[useClient]', message)
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    fetchClient()
  }, [fetchClient])

  return { client, loading, error, refetch: fetchClient }
}

// ---------------------------------------------------------------------------
// useCreateClient – mutation to create a new client
// ---------------------------------------------------------------------------

export function useCreateClient() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const createClientRecord = useCallback(async (input: CreateClientInput): Promise<ClientRow | null> => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: insertError } = await supabase
        .from('clients')
        .insert(input)
        .select()
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      return data as ClientRow
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create client'
      setError(message)
      console.error('[useCreateClient]', message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { createClient: createClientRecord, loading, error }
}

// ---------------------------------------------------------------------------
// useUpdateClient – mutation to update an existing client
// ---------------------------------------------------------------------------

export function useUpdateClient() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateClient = useCallback(async (
    clientId: string,
    input: UpdateClientInput
  ): Promise<ClientRow | null> => {
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data, error: updateError } = await supabase
        .from('clients')
        .update({ ...input, updated_at: new Date().toISOString() })
        .eq('id', clientId)
        .select()
        .single()

      if (updateError) {
        throw new Error(updateError.message)
      }

      return data as ClientRow
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update client'
      setError(message)
      console.error('[useUpdateClient]', message)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return { updateClient, loading, error }
}
