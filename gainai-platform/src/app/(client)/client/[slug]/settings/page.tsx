'use client'

import { useEffect, useState } from 'react'
import {
  Settings,
  Bell,
  User,
  Zap,
  Loader2,
  CheckCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'

interface ClientSettings {
  // Contact details
  full_name: string
  email: string
  phone: string | null

  // Notification preferences
  notify_new_reviews: boolean
  notify_post_approvals: boolean
  notify_reports: boolean

  // Auto-response settings
  auto_publish_5_star: boolean
  auto_publish_4_star: boolean
}

export default function SettingsPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [clientUserId, setClientUserId] = useState<string | null>(null)

  const [settings, setSettings] = useState<ClientSettings>({
    full_name: '',
    email: '',
    phone: '',
    notify_new_reviews: true,
    notify_post_approvals: true,
    notify_reports: true,
    auto_publish_5_star: false,
    auto_publish_4_star: false,
  })

  useEffect(() => {
    async function loadSettings() {
      setLoading(true)

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setLoading(false)
        return
      }

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('slug', slug)
        .single()

      if (!client) {
        setLoading(false)
        return
      }

      const { data: clientUser } = await supabase
        .from('client_users')
        .select(
          'id, full_name, email, phone, notify_new_reviews, notify_post_approvals, notify_reports, auto_publish_5_star, auto_publish_4_star'
        )
        .eq('auth_user_id', user.id)
        .eq('client_id', client.id)
        .single()

      if (clientUser) {
        setClientUserId(clientUser.id)
        setSettings({
          full_name: clientUser.full_name || '',
          email: clientUser.email || user.email || '',
          phone: clientUser.phone || '',
          notify_new_reviews: clientUser.notify_new_reviews ?? true,
          notify_post_approvals: clientUser.notify_post_approvals ?? true,
          notify_reports: clientUser.notify_reports ?? true,
          auto_publish_5_star: clientUser.auto_publish_5_star ?? false,
          auto_publish_4_star: clientUser.auto_publish_4_star ?? false,
        })
      }

      setLoading(false)
    }

    loadSettings()
  }, [slug, supabase])

  async function handleSave() {
    if (!clientUserId) return

    setSaving(true)
    setSaved(false)

    await supabase
      .from('client_users')
      .update({
        full_name: settings.full_name,
        email: settings.email,
        phone: settings.phone || null,
        notify_new_reviews: settings.notify_new_reviews,
        notify_post_approvals: settings.notify_post_approvals,
        notify_reports: settings.notify_reports,
        auto_publish_5_star: settings.auto_publish_5_star,
        auto_publish_4_star: settings.auto_publish_4_star,
      })
      .eq('id', clientUserId)

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function updateSetting<K extends keyof ClientSettings>(
    key: K,
    value: ClientSettings[K]
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your notification preferences and account settings
        </p>
      </div>

      {/* Contact details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Contact Details
          </CardTitle>
          <CardDescription>
            Update your contact information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={settings.full_name}
                onChange={(e) => updateSetting('full_name', e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={settings.email}
                onChange={(e) => updateSetting('email', e.target.value)}
                placeholder="your@email.com"
              />
            </div>
          </div>
          <div className="sm:w-1/2">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={settings.phone || ''}
                onChange={(e) => updateSetting('phone', e.target.value)}
                placeholder="07xxx xxxxxx"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose which email notifications you would like to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">New Reviews</p>
              <p className="text-xs text-muted-foreground">
                Get notified when a new review is posted
              </p>
            </div>
            <Switch
              checked={settings.notify_new_reviews}
              onCheckedChange={(checked) =>
                updateSetting('notify_new_reviews', checked)
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Post Approvals</p>
              <p className="text-xs text-muted-foreground">
                Get notified when a post needs your approval
              </p>
            </div>
            <Switch
              checked={settings.notify_post_approvals}
              onCheckedChange={(checked) =>
                updateSetting('notify_post_approvals', checked)
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Reports</p>
              <p className="text-xs text-muted-foreground">
                Get notified when a new report is available
              </p>
            </div>
            <Switch
              checked={settings.notify_reports}
              onCheckedChange={(checked) =>
                updateSetting('notify_reports', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Auto-response settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Auto-Response Settings
          </CardTitle>
          <CardDescription>
            Automatically publish AI-generated responses for highly-rated reviews
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-publish for 5-star reviews</p>
              <p className="text-xs text-muted-foreground">
                AI responses for 5-star reviews will be published automatically
              </p>
            </div>
            <Switch
              checked={settings.auto_publish_5_star}
              onCheckedChange={(checked) =>
                updateSetting('auto_publish_5_star', checked)
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-publish for 4-star reviews</p>
              <p className="text-xs text-muted-foreground">
                AI responses for 4-star reviews will be published automatically
              </p>
            </div>
            <Switch
              checked={settings.auto_publish_4_star}
              onCheckedChange={(checked) =>
                updateSetting('auto_publish_4_star', checked)
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
        {saved && (
          <div className="flex items-center gap-1 text-sm text-emerald-600">
            <CheckCircle className="h-4 w-4" />
            Settings saved successfully
          </div>
        )}
      </div>
    </div>
  )
}
