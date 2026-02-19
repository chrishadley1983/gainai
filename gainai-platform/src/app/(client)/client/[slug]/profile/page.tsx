'use client'

import { useEffect, useState } from 'react'
import {
  Building,
  MapPin,
  Phone,
  Globe,
  Clock,
  Star,
  Tag,
  Info,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { StarRating } from '@/components/shared/StarRating'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatNumber } from '@/lib/utils/formatting'

interface LocationProfile {
  id: string
  business_name: string
  address: string | null
  phone: string | null
  website_url: string | null
  description: string | null
  primary_category: string | null
  additional_categories: string[] | null
  google_rating: number | null
  review_count: number | null
  hours: Record<string, string> | null
  oauth_status: string
}

const DAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function ProfilePage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<LocationProfile | null>(null)

  useEffect(() => {
    async function loadProfile() {
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
        .from('gbp_locations')
        .select(
          'id, business_name, address, phone, website_url, description, primary_category, additional_categories, google_rating, review_count, hours, oauth_status'
        )
        .eq('client_id', client.id)
        .limit(1)
        .single()

      setProfile(data)
      setLoading(false)
    }

    loadProfile()
  }, [slug, supabase])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid md:grid-cols-2 gap-6">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Business Profile</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              No Google Business Profile location found.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Business Profile</h1>
        <p className="text-muted-foreground">
          Your Google Business Profile information
        </p>
      </div>

      {/* Info notice */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-blue-800">Read-only view</p>
          <p className="text-sm text-blue-700">
            Contact GainAI to update your profile information. Changes will be
            reflected on Google within 24-48 hours.
          </p>
        </div>
      </div>

      {/* Rating card */}
      {(profile.google_rating || profile.review_count) && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-4xl font-bold">
                  {profile.google_rating?.toFixed(1) ?? '--'}
                </p>
                {profile.google_rating && (
                  <StarRating rating={profile.google_rating} size="lg" />
                )}
              </div>
              <div className="h-12 w-px bg-border" />
              <div className="text-center">
                <p className="text-4xl font-bold">
                  {profile.review_count !== null
                    ? formatNumber(profile.review_count)
                    : '--'}
                </p>
                <p className="text-sm text-muted-foreground">Google Reviews</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Business information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              Business Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Business Name
              </p>
              <p className="text-sm font-medium">{profile.business_name}</p>
            </div>

            {profile.address && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Address
                </p>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                  <p className="text-sm">{profile.address}</p>
                </div>
              </div>
            )}

            {profile.phone && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Phone
                </p>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm">{profile.phone}</p>
                </div>
              </div>
            )}

            {profile.website_url && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Website
                </p>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={profile.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline truncate"
                  >
                    {profile.website_url}
                  </a>
                </div>
              </div>
            )}

            {profile.description && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  Description
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {profile.description}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categories and hours */}
        <div className="space-y-6">
          {/* Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Categories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {profile.primary_category && (
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    {profile.primary_category}
                  </Badge>
                )}
                {profile.additional_categories?.map((cat, i) => (
                  <Badge key={i} variant="outline">
                    {cat}
                  </Badge>
                ))}
                {!profile.primary_category &&
                  (!profile.additional_categories ||
                    profile.additional_categories.length === 0) && (
                    <p className="text-sm text-muted-foreground">
                      No categories set.
                    </p>
                  )}
              </div>
            </CardContent>
          </Card>

          {/* Hours */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Business Hours
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile.hours ? (
                <div className="space-y-2">
                  {DAY_ORDER.map((day) => {
                    const hours = profile.hours?.[day]
                    return (
                      <div
                        key={day}
                        className="flex items-center justify-between text-sm"
                      >
                        <span className="font-medium capitalize">{day}</span>
                        <span className="text-muted-foreground">
                          {hours || 'Closed'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Business hours not set.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
