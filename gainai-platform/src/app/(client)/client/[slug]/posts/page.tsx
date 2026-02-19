'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils/dates'
import { truncateText } from '@/lib/utils/formatting'

interface PostItem {
  id: string
  title: string | null
  summary: string
  content_type: string
  status: string
  scheduled_at: string | null
  published_at: string | null
  media_urls: string[] | null
}

const contentTypeColors: Record<string, string> = {
  standard: 'bg-blue-100 text-blue-800',
  event: 'bg-purple-100 text-purple-800',
  offer: 'bg-orange-100 text-orange-800',
  product: 'bg-green-100 text-green-800',
  alert: 'bg-red-100 text-red-800',
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number): number {
  // 0 = Sunday, 1 = Monday, etc. Adjust so Monday is first.
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const DAY_HEADERS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function PostsCalendarPage({
  params,
}: {
  params: { slug: string }
}) {
  const { slug } = params
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [posts, setPosts] = useState<PostItem[]>([])
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())

  useEffect(() => {
    async function loadPosts() {
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

      const monthStart = new Date(currentYear, currentMonth, 1).toISOString()
      const monthEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString()

      const { data } = await supabase
        .from('posts')
        .select('id, title, summary, content_type, status, scheduled_at, published_at, media_urls')
        .eq('client_id', client.id)
        .or(`scheduled_at.gte.${monthStart},published_at.gte.${monthStart}`)
        .or(`scheduled_at.lte.${monthEnd},published_at.lte.${monthEnd}`)
        .order('scheduled_at', { ascending: true })

      setPosts(data || [])
      setLoading(false)
    }

    loadPosts()
  }, [slug, currentYear, currentMonth, supabase])

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear((y) => y - 1)
    } else {
      setCurrentMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear((y) => y + 1)
    } else {
      setCurrentMonth((m) => m + 1)
    }
  }

  function getPostsForDay(day: number): PostItem[] {
    return posts.filter((post) => {
      const dateStr = post.published_at || post.scheduled_at
      if (!dateStr) return false
      const d = new Date(dateStr)
      return d.getDate() === day && d.getMonth() === currentMonth && d.getFullYear() === currentYear
    })
  }

  const daysInMonth = getDaysInMonth(currentYear, currentMonth)
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth)
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Content Calendar</h1>
          <p className="text-muted-foreground">
            View and manage your scheduled and published posts
          </p>
        </div>
        <Link href={`/client/${slug}/posts/pending`}>
          <Button variant="outline">Pending Approvals</Button>
        </Link>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <Button variant="ghost" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <CardTitle>
            {MONTH_NAMES[currentMonth]} {currentYear}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_HEADERS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-medium text-muted-foreground py-2"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells before first day */}
                {Array.from({ length: firstDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-24 rounded-md bg-muted/30" />
                ))}

                {/* Day cells */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dayPosts = getPostsForDay(day)
                  const isToday = isCurrentMonth && today.getDate() === day

                  return (
                    <div
                      key={day}
                      className={cn(
                        'h-24 rounded-md border p-1 overflow-hidden',
                        isToday && 'border-primary bg-primary/5'
                      )}
                    >
                      <div
                        className={cn(
                          'text-xs font-medium mb-1',
                          isToday ? 'text-primary' : 'text-muted-foreground'
                        )}
                      >
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayPosts.slice(0, 2).map((post) => (
                          <Link
                            key={post.id}
                            href={`/client/${slug}/posts/${post.id}`}
                            className="block"
                          >
                            <div
                              className={cn(
                                'rounded px-1 py-0.5 text-[10px] font-medium truncate cursor-pointer hover:opacity-80',
                                contentTypeColors[post.content_type.toLowerCase()] ||
                                  'bg-gray-100 text-gray-800'
                              )}
                            >
                              {post.title || truncateText(post.summary, 20)}
                            </div>
                          </Link>
                        ))}
                        {dayPosts.length > 2 && (
                          <div className="text-[10px] text-muted-foreground pl-1">
                            +{dayPosts.length - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Posts list below calendar */}
      <Card>
        <CardHeader>
          <CardTitle>All Posts This Month</CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 && !loading ? (
            <EmptyState
              icon={CalendarDays}
              title="No posts this month"
              description="There are no posts scheduled or published for this month."
            />
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/client/${slug}/posts/${post.id}`}
                  className="flex items-center gap-4 rounded-lg border p-4 hover:bg-accent transition-colors"
                >
                  <Badge
                    className={cn(
                      contentTypeColors[post.content_type.toLowerCase()] ||
                        'bg-gray-100 text-gray-800'
                    )}
                  >
                    {post.content_type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {post.title || truncateText(post.summary, 60)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {post.scheduled_at
                        ? formatDate(post.scheduled_at, 'dd MMM yyyy HH:mm')
                        : post.published_at
                        ? formatDate(post.published_at, 'dd MMM yyyy HH:mm')
                        : 'No date set'}
                    </p>
                  </div>
                  <StatusBadge status={post.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
