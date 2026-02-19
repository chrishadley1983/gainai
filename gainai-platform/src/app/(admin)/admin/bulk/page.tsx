'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Users,
  FileText,
  MapPin,
  Image,
  Target,
  Upload,
  Download,
  ClipboardList,
  ArrowRight,
} from 'lucide-react'

interface BulkType {
  key: string
  title: string
  description: string
  icon: React.ElementType
  uploadHref: string
  templateName: string
}

interface RecentJob {
  id: string
  type: string
  status: string
  total_items: number
  processed_items: number
  failed_items: number
  created_at: string
}

const BULK_TYPES: BulkType[] = [
  {
    key: 'clients',
    title: 'Client Import',
    description: 'Import multiple clients at once from a CSV file. Includes business details, contact info, and package selection.',
    icon: Users,
    uploadHref: '/admin/bulk',
    templateName: 'client-import-template.csv',
  },
  {
    key: 'posts',
    title: 'Post Import',
    description: 'Bulk import posts for scheduling. Supports all content types with scheduled dates and CTA configuration.',
    icon: FileText,
    uploadHref: '/admin/posts/import',
    templateName: 'post-import-template.csv',
  },
  {
    key: 'locations',
    title: 'Location Import',
    description: 'Add multiple locations at once. Includes address, category, and contact details for each location.',
    icon: MapPin,
    uploadHref: '/admin/locations/import',
    templateName: 'location-import-template.csv',
  },
  {
    key: 'media',
    title: 'Media Import',
    description: 'Bulk upload images and media files. Organise by client and location for easy management.',
    icon: Image,
    uploadHref: '/admin/bulk',
    templateName: 'media-import-template.csv',
  },
  {
    key: 'competitors',
    title: 'Competitor Import',
    description: 'Import competitor listings for tracking. Monitor their performance alongside your clients.',
    icon: Target,
    uploadHref: '/admin/bulk',
    templateName: 'competitor-import-template.csv',
  },
]

function downloadTemplate(name: string) {
  const headers: Record<string, string> = {
    'client-import-template.csv': 'name,slug,contact_name,contact_email,contact_phone,website_url,package_type,notes',
    'post-import-template.csv': 'client_slug,content_type,title,body,scheduled_at,cta_type,cta_url',
    'location-import-template.csv': 'client_slug,name,address,phone,website_url,primary_category',
    'media-import-template.csv': 'client_slug,location_name,file_url,category,alt_text',
    'competitor-import-template.csv': 'client_slug,competitor_name,google_place_id,address,category',
  }

  const content = headers[name] || 'column1,column2,column3'
  const blob = new Blob([content], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export default function AdminBulkPage() {
  const [recentJobs, setRecentJobs] = useState<RecentJob[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data } = await supabase
        .from('bulk_jobs')
        .select('id, type, status, total_items, processed_items, failed_items, created_at')
        .order('created_at', { ascending: false })
        .limit(5)

      if (data) {
        setRecentJobs(
          data.map((j: any) => ({
            id: j.id,
            type: j.type ?? '',
            status: j.status ?? 'PENDING',
            total_items: j.total_items ?? 0,
            processed_items: j.processed_items ?? 0,
            failed_items: j.failed_items ?? 0,
            created_at: j.created_at,
          }))
        )
      }
      setLoading(false)
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bulk Operations</h1>
          <p className="text-sm text-muted-foreground">
            Import data in bulk across your platform
          </p>
        </div>
        <Link href="/admin/bulk/jobs">
          <Button variant="outline" size="sm">
            <ClipboardList className="h-4 w-4 mr-1" />
            Job History
          </Button>
        </Link>
      </div>

      {/* Bulk type cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {BULK_TYPES.map((bt) => {
          const Icon = bt.icon
          return (
            <Card key={bt.key} className="flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-base">{bt.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-between space-y-4">
                <CardDescription>{bt.description}</CardDescription>
                <div className="flex items-center gap-2">
                  <Link href={bt.uploadHref}>
                    <Button size="sm">
                      <Upload className="h-4 w-4 mr-1" />
                      Upload
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadTemplate(bt.templateName)}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    Template
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent Jobs</h2>
          <Link href="/admin/bulk/jobs">
            <Button variant="ghost" size="sm">
              View all
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : recentJobs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No bulk jobs have been run yet.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Type</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Status</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Progress</th>
                  <th className="h-10 px-4 text-left font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id} className="border-b last:border-0 hover:bg-muted/50">
                    <td className="p-4">
                      <Badge variant="outline" className="capitalize">
                        {job.type.toLowerCase().replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="p-4">
                      <span className="text-sm">
                        {job.processed_items}/{job.total_items}
                        {job.failed_items > 0 && (
                          <span className="text-red-500 ml-1">({job.failed_items} failed)</span>
                        )}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">
                      {new Date(job.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
