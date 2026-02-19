'use client'

import * as React from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { NotificationPanel, type Notification } from './NotificationPanel'

interface NotificationBellProps {
  count: number
  notifications?: Notification[]
  onMarkRead?: (id: string) => void
  onMarkAllRead?: () => void
}

export function NotificationBell({
  count,
  notifications = [],
  onMarkRead,
  onMarkAllRead,
}: NotificationBellProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => setOpen(true)}
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>
              Your recent notifications and alerts.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4">
            <NotificationPanel
              notifications={notifications}
              onMarkRead={onMarkRead ?? (() => {})}
              onMarkAllRead={onMarkAllRead ?? (() => {})}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
