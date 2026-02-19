'use client'

import * as React from 'react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface Notification {
  id: string
  title: string
  body: string
  link?: string
  read: boolean
  created_at: string
}

interface NotificationPanelProps {
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
}

export function NotificationPanel({
  notifications,
  onMarkRead,
  onMarkAllRead,
}: NotificationPanelProps) {
  const unreadCount = notifications.filter((n) => !n.read).length

  const handleClick = (notification: Notification) => {
    if (!notification.read) {
      onMarkRead(notification.id)
    }
    if (notification.link) {
      window.location.href = notification.link
    }
  }

  return (
    <div className="flex flex-col h-full">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between pb-3 border-b mb-3">
          <span className="text-sm text-muted-foreground">
            {unreadCount} unread
          </span>
          <Button variant="ghost" size="sm" onClick={onMarkAllRead}>
            Mark all as read
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No notifications yet.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleClick(notification)}
                className={cn(
                  'w-full text-left rounded-lg p-3 transition-colors hover:bg-accent',
                  !notification.read && 'bg-accent/50'
                )}
              >
                <div className="flex items-start gap-3">
                  {!notification.read && (
                    <span className="mt-1.5 flex h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                  )}
                  <div className={cn('flex-1 min-w-0', notification.read && 'ml-5')}>
                    <p className="text-sm font-medium leading-tight truncate">
                      {notification.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                      {notification.body}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/70">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
