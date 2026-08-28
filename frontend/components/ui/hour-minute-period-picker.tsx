'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { TimeSlotList } from '@/components/ui/time-slot-list'
import type { TimeSlotOption } from '@/lib/constants/contest-scheduling'

export interface HourMinutePeriodPickerProps {
  /** 24-hour "HH:mm", same format DateTimePicker's draftTime already uses. */
  value: string
  onChange: (value: string) => void
  /** Minute grid step — mirrors the backend's start-time grid (10 by default). */
  stepMinutes?: number
  className?: string
}

/**
 * Replaces a single long scrollable "7:00 PM, 7:15 PM, 7:30 PM, …" list with three
 * short columns — Hour (1-12), Minute (grid steps within the hour), and an AM/PM
 * toggle — so picking a time is "dial the hour, dial the minute, flip AM/PM" instead
 * of hunting through 96 (or, at a 10-minute grid, 144) flattened combinations.
 *
 * Still produces/consumes the same 24-hour "HH:mm" string DateTimePicker's draftTime
 * already used with the old TimeSlotList, so nothing else about the apply/cancel
 * staging flow needed to change.
 */
export function HourMinutePeriodPicker({
  value,
  onChange,
  stepMinutes = 10,
  className,
}: HourMinutePeriodPickerProps) {
  const [hour24, minute] = React.useMemo(() => {
    const match = /^(\d{2}):(\d{2})$/.exec(value)
    return match ? [Number(match[1]), Number(match[2])] : [0, 0]
  }, [value])

  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12

  const hourOptions: TimeSlotOption[] = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => i + 1).map((h) => ({ value: String(h), label: String(h) })),
    [],
  )

  const minuteOptions: TimeSlotOption[] = React.useMemo(
    () =>
      Array.from({ length: Math.max(1, Math.floor(60 / stepMinutes)) }, (_, i) => i * stepMinutes).map((m) => ({
        value: String(m).padStart(2, '0'),
        label: String(m).padStart(2, '0'),
      })),
    [stepMinutes],
  )

  const commit = (nextHour12: number, nextMinute: number, nextPeriod: 'AM' | 'PM') => {
    const h24 = nextPeriod === 'AM' ? nextHour12 % 12 : (nextHour12 % 12) + 12
    onChange(`${String(h24).padStart(2, '0')}:${String(nextMinute).padStart(2, '0')}`)
  }

  return (
    <div className={cn('flex flex-col min-h-0', className)}>
      <div className="flex gap-1.5 flex-1 min-h-0">
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 text-center pb-1 shrink-0">
            Hour
          </div>
          <TimeSlotList
            options={hourOptions}
            value={String(hour12)}
            onSelect={(option) => commit(Number(option.value), minute, period)}
            className="max-h-40 sm:max-h-[200px]"
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground/70 text-center pb-1 shrink-0">
            Min
          </div>
          <TimeSlotList
            options={minuteOptions}
            value={String(minute).padStart(2, '0')}
            onSelect={(option) => commit(hour12, Number(option.value), period)}
            className="max-h-40 sm:max-h-[200px]"
          />
        </div>
      </div>

      <div className="flex gap-1.5 mt-2 shrink-0">
        {(['AM', 'PM'] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => commit(hour12, minute, p)}
            className={cn(
              'flex-1 text-center px-2 py-1.5 rounded-lg text-xs font-bold transition-colors',
              period === p ? 'bg-primary text-primary-foreground' : 'text-foreground bg-muted/40 hover:bg-muted/60',
            )}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}
