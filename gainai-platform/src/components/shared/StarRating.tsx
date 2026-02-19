import { Star } from 'lucide-react'
import { cn } from '@/lib/cn'

const sizeMap = {
  sm: 'h-3.5 w-3.5',
  md: 'h-5 w-5',
  lg: 'h-7 w-7',
}

interface StarRatingProps {
  rating: number
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
}

export function StarRating({
  rating,
  size = 'md',
  showValue = false,
}: StarRatingProps) {
  // Round to nearest 0.5
  const rounded = Math.round(rating * 2) / 2
  const stars = []

  for (let i = 1; i <= 5; i++) {
    if (i <= rounded) {
      // Full star
      stars.push(
        <Star
          key={i}
          className={cn(sizeMap[size], 'fill-yellow-400 text-yellow-400')}
        />
      )
    } else if (i - 0.5 === rounded) {
      // Half star - rendered using a clipped overlay
      stars.push(
        <span key={i} className="relative inline-flex">
          <Star className={cn(sizeMap[size], 'text-muted-foreground/30')} />
          <span className="absolute inset-0 overflow-hidden w-1/2">
            <Star
              className={cn(sizeMap[size], 'fill-yellow-400 text-yellow-400')}
            />
          </span>
        </span>
      )
    } else {
      // Empty star
      stars.push(
        <Star
          key={i}
          className={cn(sizeMap[size], 'text-muted-foreground/30')}
        />
      )
    }
  }

  return (
    <div className="inline-flex items-center gap-0.5">
      {stars}
      {showValue && (
        <span
          className={cn(
            'ml-1.5 font-medium text-muted-foreground',
            size === 'sm' && 'text-xs',
            size === 'md' && 'text-sm',
            size === 'lg' && 'text-base'
          )}
        >
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}
