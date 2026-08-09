'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import type { TimeSlotOption } from '@/lib/constants/contest-scheduling'

export interface TimeSlotListProps {
  options: TimeSlotOption[]
  value?: string
  onSelect: (option: TimeSlotOption) => void
  className?: string
}

/**
 * Presentational list of selectable time slots — shared by TimeSlotPicker (standalone)
 * and DateTimePicker (combined date+time), so the option-rendering logic and
 * scroll-selected-into-view behavior live in exactly one place.
 */
export function TimeSlotList({ options, value, onSelect, className }: TimeSlotListProps) {
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
    el?.scrollIntoView({ block: 'center' })
  }, [value])

  return (
    <div ref={listRef} className={cn('overflow-y-auto space-y-0.5', className)}>
      {options.map((option) => {
        const isSelected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            data-selected={isSelected}
            onClick={() => onSelect(option)}
            className={cn(
              'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors',
              isSelected ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted/60',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
