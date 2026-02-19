'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  MapPin,
  Plus,
  Link as LinkIcon,
  Phone,
  Globe,
  Loader2,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'

interface Location {
  id: string
  name: string
  address: string
  phone: string | null
  website_url: string | null
  status: string
  primary_category: string | null
  average_rating: number | null
  total_reviews: number | null
  google_location_id: string | null
  created_at: string
}

interface ClientInfo {
  id: string
  name: string
}

export default function ClientLocationsPage({
  params,
}: {
  params: { clientId: string }
}) {
  const { clientId } = params
  const router = useRouter()
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // New location form state
  const [newLocation, setNewLocation] = useState({
    name: '',
    address: '',
    phone: '',
    website_url: '',
    primary_category: '',
  })

  useEffect(() => {
    async function fetchData() {
      const supabase = createClient()

      const [clientRes, locationsRes] = await Promise.all([
        supabase
          .from('clients')
          .select('id, name')
          .eq('id', clientId)
          .single(),
        supabase
          .from('gbp_locations')
          .select('*')
          .eq('client_id', clientId)
          .order('name', { ascending: true }),
      ])

      if (clientRes.data) setClient(clientRes.data)
      if (locationsRes.data) setLocations(locationsRes.data)

      setLoading(false)
    }

    fetchData()
  }, [clientId])

  async function handleAddLocation(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const supabase = createClient()

    const { data, error } = await supabase
      .from('gbp_locations')
      .insert({
        client_id: clientId,
        name: newLocation.name,
        address: newLocation.address,
        phone: newLocation.phone || null,
        website_url: newLocation.website_url || null,
        primary_category: newLocation.primary_category || null,
        status: 'pending',
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to add location:', error)
      setSaving(false)
      return
    }

    setLocations((prev) => [...prev, data])
    setNewLocation({ name: '', address: '', phone: '', website_url: '', primary_category: '' })
    setDialogOpen(false)
    setSaving(false)
  }

  function handleConnectGoogle() {
    // Redirect to Google OAuth flow
    window.location.href = `/api/google/oauth/connect?client_id=${clientId}`
  }

  const statusOrder: Record<string, number> = {
    verified: 0,
    active: 1,
    pending: 2,
    verification_requested: 3,
    suspended: 4,
  }

  const sortedLocations = [...locations].sort(
    (a, b) => (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)
  )

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
            <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
            <p className="text-muted-foreground">
              {client?.name || 'Loading...'} - GBP Locations
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleConnectGoogle}>
            <LinkIcon className="mr-2 h-4 w-4" />
            Connect Google Account
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Location
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Location</DialogTitle>
                <DialogDescription>
                  Add a new GBP location for this client.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAddLocation} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="loc-name">Location Name *</Label>
                  <Input
                    id="loc-name"
                    required
                    value={newLocation.name}
                    onChange={(e) =>
                      setNewLocation((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g. Main Office"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc-address">Address *</Label>
                  <Input
                    id="loc-address"
                    required
                    value={newLocation.address}
                    onChange={(e) =>
                      setNewLocation((prev) => ({ ...prev, address: e.target.value }))
                    }
                    placeholder="123 High Street, Manchester, M1 1AA"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc-phone">Phone</Label>
                  <Input
                    id="loc-phone"
                    value={newLocation.phone}
                    onChange={(e) =>
                      setNewLocation((prev) => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="01onal 234 5678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc-website">Website</Label>
                  <Input
                    id="loc-website"
                    type="url"
                    value={newLocation.website_url}
                    onChange={(e) =>
                      setNewLocation((prev) => ({ ...prev, website_url: e.target.value }))
                    }
                    placeholder="https://example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="loc-category">Primary Category</Label>
                  <Input
                    id="loc-category"
                    value={newLocation.primary_category}
                    onChange={(e) =>
                      setNewLocation((prev) => ({
                        ...prev,
                        primary_category: e.target.value,
                      }))
                    }
                    placeholder="e.g. Plumber, Dentist, Restaurant"
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
                    Add Location
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Location Cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : sortedLocations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MapPin className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 text-lg font-medium">No locations yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Add a location or connect a Google account to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedLocations.map((location) => (
            <Card key={location.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{location.name}</CardTitle>
                  <StatusBadge status={location.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{location.address}</span>
                </div>

                {location.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-muted-foreground">{location.phone}</span>
                  </div>
                )}

                {location.website_url && (
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a
                      href={location.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate"
                    >
                      {location.website_url}
                    </a>
                  </div>
                )}

                {location.primary_category && (
                  <Badge variant="secondary" className="text-xs">
                    {location.primary_category}
                  </Badge>
                )}

                <div className="flex items-center justify-between border-t pt-3 mt-3">
                  {location.average_rating !== null ? (
                    <div className="flex items-center gap-1 text-sm">
                      <span className="font-medium">
                        {location.average_rating.toFixed(1)}
                      </span>
                      <span className="text-yellow-500">&#9733;</span>
                      {location.total_reviews !== null && (
                        <span className="text-muted-foreground">
                          ({location.total_reviews} reviews)
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No rating</span>
                  )}
                  {location.google_location_id && (
                    <Badge variant="outline" className="text-xs">
                      Connected
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
