'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Settings,
  ExternalLink,
} from 'lucide-react'

interface Integration {
  key: string
  name: string
  description: string
  logo: string
  status: 'connected' | 'disconnected' | 'error'
  apiHealth: 'healthy' | 'degraded' | 'down'
  quotaUsed: number
  quotaTotal: number
  lastChecked: string
}

const INTEGRATIONS: Integration[] = [
  {
    key: 'google_oauth',
    name: 'Google OAuth',
    description: 'Google Business Profile API authentication and management',
    logo: 'G',
    status: 'connected',
    apiHealth: 'healthy',
    quotaUsed: 1250,
    quotaTotal: 10000,
    lastChecked: new Date().toISOString(),
  },
  {
    key: 'claude_ai',
    name: 'Claude AI',
    description: 'AI-powered content generation and review responses',
    logo: 'C',
    status: 'connected',
    apiHealth: 'healthy',
    quotaUsed: 450,
    quotaTotal: 5000,
    lastChecked: new Date().toISOString(),
  },
  {
    key: 'stripe',
    name: 'Stripe',
    description: 'Payment processing and subscription management',
    logo: 'S',
    status: 'connected',
    apiHealth: 'healthy',
    quotaUsed: 0,
    quotaTotal: 0,
    lastChecked: new Date().toISOString(),
  },
  {
    key: 'resend',
    name: 'Resend',
    description: 'Transactional email delivery for reports and notifications',
    logo: 'R',
    status: 'connected',
    apiHealth: 'healthy',
    quotaUsed: 320,
    quotaTotal: 3000,
    lastChecked: new Date().toISOString(),
  },
  {
    key: 'slack',
    name: 'Slack',
    description: 'Team notifications and alerts for review activity',
    logo: 'Sl',
    status: 'disconnected',
    apiHealth: 'down',
    quotaUsed: 0,
    quotaTotal: 0,
    lastChecked: new Date().toISOString(),
  },
  {
    key: 'twilio',
    name: 'Twilio',
    description: 'SMS notifications for critical alerts and client communications',
    logo: 'T',
    status: 'disconnected',
    apiHealth: 'down',
    quotaUsed: 0,
    quotaTotal: 0,
    lastChecked: new Date().toISOString(),
  },
]

const statusConfig = {
  connected: {
    icon: CheckCircle2,
    label: 'Connected',
    color: 'text-emerald-500',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  disconnected: {
    icon: XCircle,
    label: 'Disconnected',
    color: 'text-gray-400',
    badgeClass: 'bg-gray-100 text-gray-800 border-gray-200',
  },
  error: {
    icon: AlertTriangle,
    label: 'Error',
    color: 'text-red-500',
    badgeClass: 'bg-red-100 text-red-800 border-red-200',
  },
}

const healthConfig = {
  healthy: {
    label: 'Healthy',
    color: 'bg-emerald-500',
  },
  degraded: {
    label: 'Degraded',
    color: 'bg-yellow-500',
  },
  down: {
    label: 'Down',
    color: 'bg-red-500',
  },
}

export default function IntegrationSettingsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS)
  const [refreshing, setRefreshing] = useState<string | null>(null)

  async function handleRefresh(key: string) {
    setRefreshing(key)
    // Simulate API health check
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIntegrations((prev) =>
      prev.map((i) =>
        i.key === key
          ? { ...i, lastChecked: new Date().toISOString() }
          : i
      )
    )
    setRefreshing(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Manage third-party service connections and API health
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {integrations.map((integration) => {
          const statusCfg = statusConfig[integration.status]
          const healthCfg = healthConfig[integration.apiHealth]
          const StatusIcon = statusCfg.icon
          const quotaPct = integration.quotaTotal > 0
            ? Math.round((integration.quotaUsed / integration.quotaTotal) * 100)
            : 0

          return (
            <Card key={integration.key} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted font-bold text-sm">
                      {integration.logo}
                    </div>
                    <div>
                      <CardTitle className="text-base">{integration.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <StatusIcon className={cn('h-4 w-4', statusCfg.color)} />
                        <span className="text-xs text-muted-foreground">
                          {statusCfg.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className={statusCfg.badgeClass}>
                    {statusCfg.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between space-y-4">
                <CardDescription>{integration.description}</CardDescription>

                {/* API Health */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">API Health</span>
                    <div className="flex items-center gap-2">
                      <div className={cn('h-2 w-2 rounded-full', healthCfg.color)} />
                      <span className="text-xs capitalize">{healthCfg.label}</span>
                    </div>
                  </div>

                  {/* Quota usage */}
                  {integration.quotaTotal > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Quota Usage</span>
                        <span className="text-xs">
                          {integration.quotaUsed.toLocaleString()}/{integration.quotaTotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            quotaPct < 70 ? 'bg-emerald-500' :
                            quotaPct < 90 ? 'bg-yellow-500' : 'bg-red-500'
                          )}
                          style={{ width: `${Math.min(quotaPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2">
                  {integration.status === 'connected' ? (
                    <>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-1" />
                        Configure
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRefresh(integration.key)}
                        disabled={refreshing === integration.key}
                      >
                        <RefreshCw
                          className={cn(
                            'h-4 w-4 mr-1',
                            refreshing === integration.key && 'animate-spin'
                          )}
                        />
                        Check
                      </Button>
                    </>
                  ) : (
                    <Button size="sm">
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Connect
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
