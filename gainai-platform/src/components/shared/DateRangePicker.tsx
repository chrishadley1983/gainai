'use client'

import * as React from 'react'
import { format, subDays, subMonths, startOfMonth, endOfMonth } from 'date-fns'
import { CalendarDays } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DateRangePreset {
  label: string
  from: Date
  to: Date
}

interface DateRangePickerProps {
  from?: Date
  to?: Date
  onChange: (range: { from: Date | undefined; to: Date | undefined }) => void
  presets?: DateRangePreset[]
}

const defaultPresets: DateRangePreset[] = [
  {
    label: 'Last 7 days',
    from: subDays(new Date(), 7),
    to: new Date(),
  },
  {
    label: 'Last 30 days',
    from: subDays(new Date(), 30),
    to: new Date(),
  },
  {
    label: 'Last 3 months',
    from: subMonths(new Date(), 3),
    to: new Date(),
  },
  {
    label: 'This month',
    from: startOfMonth(new Date()),
    to: new Date(),
  },
  {
    label: 'Last month',
    from: startOfMonth(subMonths(new Date(), 1)),
    to: endOfMonth(subMonths(new Date(), 1)),
  },
]

export function DateRangePicker({
  from,
  to,
  onChange,
  presets = defaultPresets,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [localFrom, setLocalFrom] = React.useState(from ? format(from, 'yyyy-MM-dd') : '')
  const [localTo, setLocalTo] = React.useState(to ? format(to, 'yyyy-MM-dd') : '')

  React.useEffect(() => {
    setLocalFrom(from ? format(from, 'yyyy-MM-dd') : '')
    setLocalTo(to ? format(to, 'yyyy-MM-dd') : '')
  }, [from, to])

  const handleApply = () => {
    onChange({
      from: localFrom ? new Date(localFrom + 'T00:00:00') : undefined,
      to: localTo ? new Date(localTo + 'T00:00:00') : undefined,
    })
    setOpen(false)
  }

  const handlePreset = (preset: DateRangePreset) => {
    onChange({ from: preset.from, to: preset.to })
    setOpen(false)
  }

  const displayText =
    from && to
      ? `${format(from, 'MMM d, yyyy')} - ${format(to, 'MMM d, yyyy')}`
      : 'Select date range'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'justify-start text-left font-normal',
            !from && !to && 'text-muted-foreground'
          )}
        >
          <CalendarDays className="mr-2 h-4 w-4" />
          {displayText}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          <div className="border-r p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Presets
            </p>
            {presets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset)}
                className="block w-full text-left rounded-md px-3 py-1.5 text-sm hover:bg-accent transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="p-3 space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                From
              </label>
              <input
                type="date"
                value={localFrom}
                onChange={(e) => setLocalFrom(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                To
              </label>
              <input
                type="date"
                value={localTo}
                onChange={(e) => setLocalTo(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <Button onClick={handleApply} size="sm" className="w-full">
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
