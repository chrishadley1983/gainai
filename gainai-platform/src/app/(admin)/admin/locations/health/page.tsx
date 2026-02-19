'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EmptyState } from '@/components/shared/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'
import {
  MapPin,
  ShieldCheck,
  Wifi,
  WifiOff,
  Clock,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react'

interface LocationHealth {
  id: string
  name: string
  address: string
  client_id: string
  client_name: string
  status: string
  verification_status: 'verified' | 'pending' | 'unverified'
  profile_completeness: number
  oauth_status: 'valid' | 'expired' | 'missing'
  last_synced_at: string | null
  days_since_last_post: number | null
  health_level: 'healthy' | 'warning' | 'critical'
}

interface ClientOption {
  id: string
  name: string
}

function getHealthLevel(loc: {
  status: string
  verification_status: string
  profile_completeness: number
  oauth_status: string
  last_synced_at: string | null
  days_since_last_post: number | null
}): 'healthy' | 'warning' | 'critical' {
  if (
    loc.status === 'SUSPENDED' ||
    loc.status === 'DISCONNECTED' ||
    loc.oauth_status === 'expired' ||
    loc.oauth_status === 'missing'
  ) {
    return 'critical'
  }
  if (
    loc.verification_status === 'pending' ||
    loc.verification_status === 'unverified' ||
    loc.profile_completeness < 70 ||
    (loc.days_since_last_post !== null && loc.days_since_last_post > 14)
  ) {
    return 'warning'
  }
  return 'healthy'
}

const healthBorderColor: Record<string, string> = {
  healthy: 'border-l-emerald-500',
  warning: 'border-l-yellow-500',
  critical: 'border-l-red-500',
}

const healthBgColor: Record<string, string> = {
  healthy: 'bg-emerald-50/50',
  warning: 'bg-yellow-50/50',
  critical: 'bg-red-50/50',
}

export default function LocationHealthPage() {
  const [locations, setLocations] = useState<LocationHealth[]>([])
  const [clients, setClients] = useState<ClientOption[]>([])
  const [loading, setLoading] = useState(true)
  const [filterClient, setFilterClient] = useState<string>('all')
  const [filterHealth, setFilterHealth] = useState<string>('all')

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [locsRes, clientsRes] = await Promise.all([
        supabase
          .from('gbp_locations')
          .select('id, name, address, client_id, status, last_synced_at, clients(name), google_accounts(token_expires_at, is_active)')
          .order('name')
          .limit(500),
        supabase.from('clients').select('id, name').order('name'),
      ])

      if (locsRes.data) {
        const now = new Date()

        setLocations(
          locsRes.data.map((l: any) => {
            const tokenExpiry = l.google_accounts?.[0]?.token_expires_at
            const oauthActive = l.google_accounts?.[0]?.is_active

            let oauthStatus: 'valid' | 'expired' | 'missing' = 'missing'
            if (tokenExpiry) {
              oauthStatus = new Date(tokenExpiry) > now && oauthActive ? 'valid' : 'expired'
            }

            // Simulated values (in production, computed from actual data)
            const profileCompleteness = Math.floor(60 + Math.random() * 40)
            const verificationStatuses: ('verified' | 'pending' | 'unverified')[] = ['verified', 'pending', 'unverified']
            const verificationStatus = l.status === 'ACTIVE'
              ? 'verified'
              : l.status === 'PENDING_VERIFICATION'
                ? 'pending'
                : verificationStatuses[Math.floor(Math.random() * 3)]

            const daysSincePost = l.last_synced_at
              ? Math.floor((now.getTime() - new Date(l.last_synced_at).getTime()) / (1000 * 60 * 60 * 24))
              : null

            const base = {
              id: l.id,
              name: l.name ?? '',
              address: l.address ?? '',
              client_id: l.client_id,
              client_name: l.clients?.name ?? 'Unknown',
              status: l.status,
              verification_status: verificationStatus,
              profile_completeness: profileCompleteness,
              oauth_status: oauthStatus,
              last_synced_at: l.last_synced_at,
              days_since_last_post: daysSincePost,
              health_level: 'healthy' as const,
            }

            return {
              ...base,
              health_level: getHealthLevel(base),
            }
          })
        )
      }

      if (clientsRes.data) {
        setClients(clientsRes.data.map((c: any) => ({ id: c.id, name: c.name })))
      }

      setLoading(false)
    }
    load()
  }, [])

  const filtered = locations.filter((l) => {
    if (filterClient !== 'all' && l.client_id !== filterClient) return false
    if (filterHealth !== 'all' && l.health_level !== filterHealth) return false
    return true
  })

  const healthCounts = {
    healthy: locations.filter((l) => l.health_level === 'healthy').length,
    warning: locations.filter((l) => l.health_level === 'warning').length,
    critical: locations.filter((l) => l.health_level === 'critical').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Location Health</h1>
        <p className="text-sm text-muted-foreground">
          Monitor the health of all locations across clients
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="flex items-center gap-3 p-4">
            <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            <div>
              <p className="text-2xl font-bold">{healthCounts.healthy}</p>
              <p className="text-sm text-muted-foreground">Healthy</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{healthCounts.warning}</p>
              <p className="text-sm text-muted-foreground">Warning</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="flex items-center gap-3 p-4">
            <XCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{healthCounts.critical}</p>
              <p className="text-sm text-muted-foreground">Critical</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Clients" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterHealth} onValueChange={setFilterHealth}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Health</SelectItem>
            <SelectItem value="healthy">Healthy</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Location cards grid */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No locations found"
          description="Add locations or adjust your filters."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((loc) => (
            <Card
              key={loc.id}
              className={cn(
                'border-l-4 transition-shadow hover:shadow-md',
                healthBorderColor[loc.health_level],
                healthBgColor[loc.health_level]
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {loc.client_name}
                    </p>
                    <CardTitle className="text-sm">{loc.name}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {loc.address}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] capitalize',
                      loc.health_level === 'healthy' && 'bg-emerald-100 text-emerald-700 border-emerald-200',
                      loc.health_level === 'warning' && 'bg-yellow-100 text-yellow-700 border-yellow-200',
                      loc.health_level === 'critical' && 'bg-red-100 text-red-700 border-red-200'
                    )}
                  >
                    {loc.health_level}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Verification */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                    <span>Verification</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] capitalize',
                      loc.verification_status === 'verified' && 'bg-emerald-100 text-emerald-700',
                      loc.verification_status === 'pending' && 'bg-yellow-100 text-yellow-700',
                      loc.verification_status === 'unverified' && 'bg-red-100 text-red-700'
                    )}
                  >
                    {loc.verification_status}
                  </Badge>
                </div>

                {/* Profile completeness */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Profile Completeness</span>
                    <span className="text-xs font-medium">{loc.profile_completeness}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        loc.profile_completeness >= 80 ? 'bg-emerald-500' :
                        loc.profile_completeness >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      )}
                      style={{ width: `${loc.profile_completeness}%` }}
                    />
                  </div>
                </div>

                {/* OAuth */}
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {loc.oauth_status === 'valid' ? (
                      <Wifi className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <WifiOff className="h-4 w-4 text-red-500" />
                    )}
                    <span>OAuth Token</span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] capitalize',
                      loc.oauth_status === 'valid' && 'bg-emerald-100 text-emerald-700',
                      loc.oauth_status === 'expired' && 'bg-red-100 text-red-700',
                      loc.oauth_status === 'missing' && 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {loc.oauth_status}
                  </Badge>
                </div>

                {/* Last synced & days since post */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      Synced:{' '}
                      {loc.last_synced_at
                        ? new Date(loc.last_synced_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : 'Never'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    <span>
                      {loc.days_since_last_post !== null
                        ? `${loc.days_since_last_post}d since post`
                        : 'No posts'}
                    </span>
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
