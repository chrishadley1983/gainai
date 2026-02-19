import { cn } from '@/lib/cn'
import { Badge } from '@/components/ui/badge'

const statusColorMap: Record<string, string> = {
  // Green statuses
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  published: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  verified: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  // Yellow statuses
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  draft: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  onboarding: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  // Red statuses
  failed: 'bg-red-100 text-red-800 border-red-200',
  churned: 'bg-red-100 text-red-800 border-red-200',
  suspended: 'bg-red-100 text-red-800 border-red-200',
  // Blue statuses
  paused: 'bg-blue-100 text-blue-800 border-blue-200',
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
}

interface StatusBadgeProps {
  status: string
  variant?: 'default' | 'outline'
}

export function StatusBadge({ status, variant = 'default' }: StatusBadgeProps) {
  const normalized = status.toLowerCase()
  const colorClasses = statusColorMap[normalized] ?? 'bg-gray-100 text-gray-800 border-gray-200'

  return (
    <Badge
      variant={variant}
      className={cn(
        'capitalize',
        variant === 'default' && colorClasses
      )}
    >
      {status}
    </Badge>
  )
}
