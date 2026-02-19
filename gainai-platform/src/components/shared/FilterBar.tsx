'use client'

import * as React from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FilterOption {
  label: string
  value: string
}

interface FilterDefinition {
  key: string
  label: string
  options: FilterOption[]
}

interface FilterBarProps {
  filters: FilterDefinition[]
  activeFilters: Record<string, string>
  onChange: (filters: Record<string, string>) => void
}

export function FilterBar({ filters, activeFilters, onChange }: FilterBarProps) {
  const hasActiveFilters = Object.values(activeFilters).some((v) => v !== '' && v !== undefined)

  const handleFilterChange = (key: string, value: string) => {
    const updated = { ...activeFilters, [key]: value === '__all__' ? '' : value }
    onChange(updated)
  }

  const handleClearAll = () => {
    const cleared: Record<string, string> = {}
    filters.forEach((f) => {
      cleared[f.key] = ''
    })
    onChange(cleared)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {filters.map((filter) => (
        <Select
          key={filter.key}
          value={activeFilters[filter.key] || '__all__'}
          onValueChange={(value) => handleFilterChange(filter.key, value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder={filter.label} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All {filter.label}</SelectItem>
            {filter.options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="text-muted-foreground"
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Clear all
        </Button>
      )}
    </div>
  )
}
