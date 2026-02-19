'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ChevronLeft, ChevronRight, Plus, CalendarDays } from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
} from 'date-fns'

interface CalendarPost {
  id: string
  summary: string
  status: string
  content_type: string
  scheduled_at: string | null
  published_at: string | null
  created_at: string
  client_id: string
  client_name: string
  client_color: string
}

const CLIENT_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-purple-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-pink-500',
  'bg-teal-500',
  'bg-orange-500',
]

export default function PostsCalendarPage() {
  const [posts, setPosts] = useState<CalendarPost[]>([])
  const [loading, setLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month')
  const [selectedPost, setSelectedPost] = useState<CalendarPost | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const { data } = await supabase
        .from('posts')
        .select('id, summary, status, content_type, scheduled_at, published_at, created_at, client_id, clients(name)')
        .order('scheduled_at', { ascending: true })
        .limit(1000)

      if (data) {
        const clientColorMap: Record<string, string> = {}
        let colorIdx = 0

        setPosts(
          data.map((p: any) => {
            const cid = p.client_id
            if (!clientColorMap[cid]) {
              clientColorMap[cid] = CLIENT_COLORS[colorIdx % CLIENT_COLORS.length]
              colorIdx++
            }
            return {
              id: p.id,
              summary: p.summary ?? '',
              status: p.status,
              content_type: p.content_type,
              scheduled_at: p.scheduled_at,
              published_at: p.published_at,
              created_at: p.created_at,
              client_id: cid,
              client_name: p.clients?.name ?? 'Unknown',
              client_color: clientColorMap[cid],
            }
          })
        )
      }

      setLoading(false)
    }

    load()
  }, [])

  const getPostDate = (post: CalendarPost): Date => {
    const dateStr = post.scheduled_at || post.published_at || post.created_at
    return new Date(dateStr)
  }

  // Build calendar days
  const calendarDays = useMemo(() => {
    if (viewMode === 'month') {
      const monthStart = startOfMonth(currentDate)
      const monthEnd = endOfMonth(currentDate)
      const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
      const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

      const days: Date[] = []
      let day = calStart
      while (day <= calEnd) {
        days.push(day)
        day = addDays(day, 1)
      }
      return days
    } else {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
      const days: Date[] = []
      for (let i = 0; i < 7; i++) {
        days.push(addDays(weekStart, i))
      }
      return days
    }
  }, [currentDate, viewMode])

  const postsForDay = (day: Date) =>
    posts.filter((p) => isSameDay(getPostDate(p), day))

  const navigatePrev = () => {
    setCurrentDate(viewMode === 'month' ? subMonths(currentDate, 1) : subWeeks(currentDate, 1))
  }

  const navigateNext = () => {
    setCurrentDate(viewMode === 'month' ? addMonths(currentDate, 1) : addWeeks(currentDate, 1))
  }

  const weekDayHeaders = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Post Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Visual schedule of posts across all clients
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant={viewMode === 'month' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('month')}
            >
              Month
            </Button>
            <Button
              variant={viewMode === 'week' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('week')}
            >
              Week
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
            Today
          </Button>
        </div>
        <h2 className="text-lg font-semibold">
          {viewMode === 'month'
            ? format(currentDate, 'MMMM yyyy')
            : `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`}
        </h2>
        <div />
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-px">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div>
          {/* Day headers */}
          <div className="grid grid-cols-7 gap-px border-b mb-px">
            {weekDayHeaders.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div
            className={cn(
              'grid grid-cols-7 gap-px',
              viewMode === 'week' ? 'grid-rows-1' : ''
            )}
          >
            {calendarDays.map((day) => {
              const dayPosts = postsForDay(day)
              const isCurrentMonth = isSameMonth(day, currentDate)
              const today = isToday(day)

              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-28 border p-1.5 cursor-pointer transition-colors hover:bg-accent/50',
                    !isCurrentMonth && viewMode === 'month' && 'bg-muted/30',
                    today && 'bg-primary/5'
                  )}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        'text-xs font-medium',
                        today && 'flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground',
                        !isCurrentMonth && viewMode === 'month' && 'text-muted-foreground'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayPosts.length > 0 && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1">
                        {dayPosts.length}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    {dayPosts.slice(0, 3).map((post) => (
                      <button
                        key={post.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedPost(post)
                        }}
                        className={cn(
                          'w-full truncate rounded px-1 py-0.5 text-left text-[10px] text-white transition-opacity hover:opacity-80',
                          post.client_color
                        )}
                      >
                        {post.client_name}: {post.summary?.slice(0, 30)}
                      </button>
                    ))}
                    {dayPosts.length > 3 && (
                      <p className="text-[10px] text-muted-foreground pl-1">
                        +{dayPosts.length - 3} more
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Post detail dialog */}
      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post Details</DialogTitle>
            <DialogDescription>
              {selectedPost?.client_name} - {selectedPost?.content_type?.toLowerCase().replace('_', ' ')}
            </DialogDescription>
          </DialogHeader>
          {selectedPost && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Content</p>
                <p className="text-sm">{selectedPost.summary || 'No content'}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                  <Badge variant="outline" className="capitalize">
                    {selectedPost.status?.toLowerCase().replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Scheduled</p>
                  <p className="text-sm">
                    {selectedPost.scheduled_at
                      ? format(new Date(selectedPost.scheduled_at), 'PPp')
                      : 'Not scheduled'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setSelectedPost(null)}>
                  Close
                </Button>
                <Button>Edit Post</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New post on date dialog */}
      <Dialog open={!!selectedDate} onOpenChange={() => setSelectedDate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d, yyyy') : ''}
            </DialogTitle>
            <DialogDescription>
              {selectedDate
                ? `${postsForDay(selectedDate).length} post(s) scheduled`
                : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedDate && (
            <div className="space-y-4">
              {postsForDay(selectedDate).length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {postsForDay(selectedDate).map((post) => (
                    <Card key={post.id} className="cursor-pointer" onClick={() => {
                      setSelectedDate(null)
                      setSelectedPost(post)
                    }}>
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">{post.client_name}</p>
                        <p className="text-sm line-clamp-2">{post.summary?.slice(0, 80)}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              <Button className="w-full">
                <Plus className="h-4 w-4 mr-1" />
                Create Post for {selectedDate ? format(selectedDate, 'MMM d') : ''}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
