'use client'

import * as React from 'react'
import { Clock, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TimeSlotList } from '@/components/ui/time-slot-list'
import {
  getTimeSlotOptions,
  CONTEST_START_TIME_SLOT_MINUTES,
  type TimeSlotOption,
} from '@/lib/constants/contest-scheduling'

export interface TimeSlotPickerProps {
  /** 24-hour "HH:mm" */
  value?: string
  onChange?: (value: string) => void
  /** Grid step in minutes — defaults to the contest start-time grid (15). */
  stepMinutes?: number
  placeholder?: string
  className?: string
  align?: 'center' | 'end' | 'start'
  disabled?: boolean
}

/**
 * Replaces the native <input type="time"> for any field the backend enforces onto a
 * fixed-minute grid (currently just contest startTime — see
 * docs/contest-start-reliability-spec.md §6.4). Native time pickers show every minute
 * value and only loosely respect the `step` attribute, so an admin could pick 12:07 and
 * only find out it's invalid after submitting. This only ever offers valid slots, so
 * the invalid state is unreachable through the UI rather than just rejected after entry.
 */
export function TimeSlotPicker({
  value,
  onChange,
  stepMinutes = CONTEST_START_TIME_SLOT_MINUTES,
  placeholder = 'Pick a time',
  className,
  align = 'start',
  disabled = false,
}: TimeSlotPickerProps) {
  const [open, setOpen] = React.useState(false)
  const options = React.useMemo(() => getTimeSlotOptions(stepMinutes), [stepMinutes])
  const selected = options.find((o) => o.value === value)

  const handleSelect = (option: TimeSlotOption) => {
    onChange?.(option.value)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!selected}
          className={cn(
            'flex items-center justify-between px-3 h-9 bg-background border border-border rounded-lg text-xs font-semibold text-left select-none transition-all duration-200 outline-none w-full',
            open && 'border-primary ring-2 ring-primary/10 shadow-sm',
            !selected && 'text-muted-foreground',
            className,
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <Clock className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{selected ? selected.label : placeholder}</span>
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-1.5 w-[140px] shadow-xl border border-border bg-popover rounded-xl" align={align}>
        <TimeSlotList options={options} value={value} onSelect={handleSelect} className="max-h-64 pr-1" />
      </PopoverContent>
    </Popover>
  )
}
