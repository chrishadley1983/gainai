'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { slugify } from '@/lib/utils/formatting'

const clientSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  slug: z.string().min(1, 'Slug is required'),
  contact_name: z.string().optional(),
  contact_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  contact_phone: z.string().optional(),
  industry: z.string().optional(),
  address_line1: z.string().optional(),
  address_city: z.string().optional(),
  address_county: z.string().optional(),
  address_postcode: z.string().optional(),
  website: z.string().url('Invalid URL').optional().or(z.literal('')),
  package: z.enum(['starter', 'growth', 'premium']),
  monthly_fee: z.number().min(0, 'Monthly fee must be positive'),
  brand_voice: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
})

type ClientFormData = z.infer<typeof clientSchema>

const industries = [
  'Accounting',
  'Automotive',
  'Beauty & Spa',
  'Construction',
  'Dental',
  'Education',
  'Financial Services',
  'Fitness & Gym',
  'Food & Beverage',
  'Healthcare',
  'Home Services',
  'Hospitality',
  'Legal',
  'Manufacturing',
  'Marketing',
  'Pet Services',
  'Property',
  'Recruitment',
  'Retail',
  'Technology',
  'Trades',
  'Travel',
  'Veterinary',
  'Other',
]

export default function NewClientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<ClientFormData>({
    name: '',
    slug: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    industry: '',
    address_line1: '',
    address_city: '',
    address_county: '',
    address_postcode: '',
    website: '',
    package: 'starter',
    monthly_fee: 0,
    brand_voice: '',
    notes: '',
    tags: '',
  })

  function updateField<K extends keyof ClientFormData>(key: K, value: ClientFormData[K]) {
    setForm((prev) => {
      const updated = { ...prev, [key]: value }
      // Auto-generate slug from name
      if (key === 'name') {
        updated.slug = slugify(value as string)
      }
      return updated
    })
    // Clear field error
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    const result = clientSchema.safeParse(form)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as string
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    setSaving(true)

    try {
      const supabase = createClient()

      // Parse brand_voice as JSON if provided
      let brandVoice = null
      if (form.brand_voice && form.brand_voice.trim()) {
        try {
          brandVoice = JSON.parse(form.brand_voice)
        } catch {
          brandVoice = { description: form.brand_voice }
        }
      }

      // Parse tags
      const tags = form.tags
        ? form.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : []

      // Pack address fields into jsonb
      const address = (form.address_line1 || form.address_city || form.address_county || form.address_postcode)
        ? {
            line1: form.address_line1 || null,
            city: form.address_city || null,
            county: form.address_county || null,
            postcode: form.address_postcode || null,
          }
        : null

      const { data, error } = await supabase
        .from('clients')
        .insert({
          name: form.name,
          slug: form.slug,
          status: 'onboarding',
          contact_name: form.contact_name || null,
          contact_email: form.contact_email || null,
          contact_phone: form.contact_phone || null,
          industry: form.industry || null,
          address,
          website: form.website || null,
          package: form.package,
          monthly_fee: form.monthly_fee,
          brand_voice: brandVoice,
          notes: form.notes || null,
          tags,
        })
        .select('id')
        .single()

      if (error) {
        console.error('Failed to create client:', error)
        setErrors({ name: error.message })
        setSaving(false)
        return
      }

      router.push(`/admin/clients/${data.id}`)
    } catch (err) {
      console.error('Unexpected error creating client:', err)
      setErrors({ name: 'An unexpected error occurred' })
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/admin/clients')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">New Client</h1>
          <p className="text-muted-foreground">
            Add a new client to the platform
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Client Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="e.g. Acme Plumbing Ltd"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => updateField('slug', e.target.value)}
                placeholder="auto-generated-from-name"
              />
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="industry">Industry</Label>
              <Select
                value={form.industry}
                onValueChange={(val) => updateField('industry', val)}
              >
                <SelectTrigger id="industry">
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {industries.map((ind) => (
                    <SelectItem key={ind} value={ind.toLowerCase()}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                type="url"
                value={form.website}
                onChange={(e) => updateField('website', e.target.value)}
                placeholder="https://example.com"
              />
              {errors.website && (
                <p className="text-xs text-destructive">{errors.website}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Contact Details */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input
                id="contact_name"
                value={form.contact_name}
                onChange={(e) => updateField('contact_name', e.target.value)}
                placeholder="John Smith"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={form.contact_email}
                onChange={(e) => updateField('contact_email', e.target.value)}
                placeholder="john@example.com"
              />
              {errors.contact_email && (
                <p className="text-xs text-destructive">{errors.contact_email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_phone">Contact Phone</Label>
              <Input
                id="contact_phone"
                value={form.contact_phone}
                onChange={(e) => updateField('contact_phone', e.target.value)}
                placeholder="07700 900000"
              />
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle>Address</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input
                id="address_line1"
                value={form.address_line1}
                onChange={(e) => updateField('address_line1', e.target.value)}
                placeholder="123 High Street"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_city">City / Town</Label>
              <Input
                id="address_city"
                value={form.address_city}
                onChange={(e) => updateField('address_city', e.target.value)}
                placeholder="Manchester"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_county">County</Label>
              <Input
                id="address_county"
                value={form.address_county}
                onChange={(e) => updateField('address_county', e.target.value)}
                placeholder="Greater Manchester"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address_postcode">Postcode</Label>
              <Input
                id="address_postcode"
                value={form.address_postcode}
                onChange={(e) => updateField('address_postcode', e.target.value)}
                placeholder="M1 1AA"
              />
            </div>
          </CardContent>
        </Card>

        {/* Package & Billing */}
        <Card>
          <CardHeader>
            <CardTitle>Package & Billing</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="package">Package *</Label>
              <Select
                value={form.package}
                onValueChange={(val) =>
                  updateField('package', val as 'starter' | 'growth' | 'premium')
                }
              >
                <SelectTrigger id="package">
                  <SelectValue placeholder="Select package" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="growth">Growth</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthly_fee">Monthly Fee (GBP)</Label>
              <Input
                id="monthly_fee"
                type="number"
                min="0"
                step="0.01"
                value={form.monthly_fee || ''}
                onChange={(e) =>
                  updateField('monthly_fee', parseFloat(e.target.value) || 0)
                }
                placeholder="299.00"
              />
              {errors.monthly_fee && (
                <p className="text-xs text-destructive">{errors.monthly_fee}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Brand Voice & Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Brand Voice & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand_voice">Brand Voice (JSON or description)</Label>
              <Textarea
                id="brand_voice"
                rows={4}
                value={form.brand_voice}
                onChange={(e) => updateField('brand_voice', e.target.value)}
                placeholder='{"tone": "friendly", "style": "professional", "keywords": ["reliable", "expert"]}'
              />
              <p className="text-xs text-muted-foreground">
                Enter a JSON object or plain text description of the brand voice
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                placeholder="Any internal notes about this client..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={form.tags}
                onChange={(e) => updateField('tags', e.target.value)}
                placeholder="vip, local, multi-location (comma separated)"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of tags
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/admin/clients')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Client
          </Button>
        </div>
      </form>
    </div>
  )
}
