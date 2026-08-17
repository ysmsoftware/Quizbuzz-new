'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { CalendarClock, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { TimeSlotList } from '@/components/ui/time-slot-list'
import { getTimeSlotOptions, CONTEST_START_TIME_SLOT_MINUTES } from '@/lib/constants/contest-scheduling'

export interface DateTimePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  /** Grid step in minutes for the time column — defaults to the contest start-time grid (15). */
  stepMinutes?: number
  placeholder?: string
  className?: string
  align?: 'center' | 'end' | 'start'
  disabled?: boolean
  /** Opens the popover immediately on mount — used where the picker replaces an inline
   * edit affordance that previously auto-focused a native input. */
  autoOpen?: boolean
  disabledDays?: any
}

const CALENDAR_CLASSNAMES = {
  month_caption: 'flex items-center justify-center h-9 w-full relative mb-4',
  caption_label: 'text-xs font-black uppercase tracking-wider text-foreground select-none',
  nav: 'flex items-center justify-between w-full absolute top-0 inset-x-0 z-20 pointer-events-none px-1',
  button_previous:
    'h-7 w-7 rounded-full border border-border/40 hover:border-primary hover:bg-muted/30 flex items-center justify-center transition-all cursor-pointer pointer-events-auto',
  button_next:
    'h-7 w-7 rounded-full border border-border/40 hover:border-primary hover:bg-muted/30 flex items-center justify-center transition-all cursor-pointer pointer-events-auto',
  table: 'w-full border-collapse space-y-1',
  head_cell: 'text-muted-foreground/80 w-8 font-bold text-[10px] uppercase tracking-wider text-center py-2 select-none',
  cell: 'h-8 w-8 text-center text-xs relative p-0 focus-within:relative focus-within:z-20',
  day: 'h-8 w-8 p-0 font-normal transition-all rounded-full hover:bg-muted/50 cursor-pointer flex items-center justify-center',
  day_selected: 'bg-primary text-primary-foreground font-bold hover:bg-primary/90 rounded-full',
  day_today: 'bg-accent/40 text-accent-foreground font-bold',
  day_outside: 'text-muted-foreground/30 opacity-40',
  day_disabled: 'text-muted-foreground/20 opacity-30 cursor-not-allowed',
  day_hidden: 'invisible',
} as const

/**
 * Combined date + time picker — one trigger, one popover, matching the app's existing
 * Popover/Calendar/Button styling instead of the native <input type="date"|"datetime-local">
 * widget (browser-default pickers show every raw value with no way to constrain the
 * displayed options — see docs/contest-start-reliability-spec.md §6.4).
 *
 * Selection is staged: picking a date or a time slot only updates an internal draft.
 * Nothing commits to `value` until "Apply" is clicked; "Cancel" (or clicking outside)
 * discards the draft. The trigger always shows the full committed date + time, never
 * truncated, so what's selected is unambiguous at a glance.
 */
export function DateTimePicker({
  value,
  onChange,
  stepMinutes = CONTEST_START_TIME_SLOT_MINUTES,
  placeholder = 'Pick date & time',
  className,
  align = 'start',
  disabled = false,
  autoOpen = false,
  disabledDays,
}: DateTimePickerProps) {
  const options = React.useMemo(() => getTimeSlotOptions(stepMinutes), [stepMinutes])

  const toTimeValue = React.useCallback(
    (d?: Date) =>
      d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : options[0]?.value ?? '00:00',
    [options],
  )

  const [open, setOpenState] = React.useState(autoOpen)
  const [draftDate, setDraftDate] = React.useState<Date | undefined>(value)
  const [draftTime, setDraftTime] = React.useState<string>(() => toTimeValue(value))

  // Re-seed the draft from the committed value every time the popover opens, so a
  // cancelled edit never leaks into the next time it's opened.
  const setOpen = (next: boolean) => {
    setOpenState(next)
    if (next) {
      setDraftDate(value)
      setDraftTime(toTimeValue(value))
    }
  }

  const handleApply = () => {
    if (!draftDate) {
      setOpen(false)
      return
    }
    const [h, m] = draftTime.split(':').map(Number)
    const combined = new Date(draftDate)
    combined.setHours(h, m, 0, 0)
    onChange?.(combined)
    setOpen(false)
  }

  const displayLabel = value ? format(value, "MMM d, yyyy 'at' h:mm a") : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!value}
          className={cn(
            'flex items-center justify-between gap-2 px-3 h-10 bg-background border border-border rounded-lg text-xs font-semibold text-left select-none transition-all duration-200 outline-none w-full',
            open && 'border-primary ring-2 ring-primary/10 shadow-sm',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            <CalendarClock className="h-4 w-4 text-primary shrink-0" />
            {/* Deliberately not truncated — the whole point is the selection is always
                fully visible, not clipped behind an ellipsis. */}
            <span className="whitespace-nowrap">{displayLabel}</span>
          </span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200',
              open && 'rotate-180',
            )}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-auto shadow-xl border border-border bg-popover rounded-xl overflow-hidden" align={align}>
        <div className="flex flex-col sm:flex-row">
          <Calendar
            mode="single"
            selected={draftDate}
            onSelect={setDraftDate}
            defaultMonth={draftDate}
            showOutsideDays
            disabled={disabledDays}
            className="p-3 border-none bg-transparent"
            classNames={CALENDAR_CLASSNAMES}
          />
          <div className="sm:border-l border-t sm:border-t-0 border-border p-2 sm:w-[136px] flex flex-col min-h-0">
            <div className="text-[10px] font-black uppercase tracking-wider text-muted-foreground px-1 pb-1.5 pt-0.5 shrink-0">
              Time
            </div>
            <TimeSlotList
              options={options}
              value={draftTime}
              onSelect={(option) => setDraftTime(option.value)}
              className="max-h-56 sm:max-h-[260px] pr-1"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border p-2.5 bg-muted/20">
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleApply} disabled={!draftDate}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
