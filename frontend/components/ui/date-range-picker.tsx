'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, ChevronDown, RefreshCw } from 'lucide-react'
import { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface DateRangeValue {
  start: string
  end: string
}

interface DateRangePickerProps {
  value: DateRangeValue | null
  onChange: (value: DateRangeValue | null) => void
  label?: string
  className?: string
}

export function DateRangePicker({
  value,
  onChange,
  label = 'Date',
  className
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    if (!value?.start) return undefined
    return {
      from: new Date(value.start),
      to: value.end ? new Date(value.end) : undefined
    }
  })

  // Synchronize internal state with outer value updates
  React.useEffect(() => {
    if (!value) {
      setRange(undefined)
    } else {
      setRange({
        from: value.start ? new Date(value.start) : undefined,
        to: value.end ? new Date(value.end) : undefined
      })
    }
  }, [value])

  const handleSelect = (selectedRange: DateRange | undefined) => {
    setRange(selectedRange)
    if (selectedRange?.from) {
      const startStr = format(selectedRange.from, 'yyyy-MM-dd')
      const endStr = selectedRange.to ? format(selectedRange.to, 'yyyy-MM-dd') : startStr
      onChange({ start: startStr, end: endStr })
    } else {
      onChange(null)
    }
  }

  const displayValue = React.useMemo(() => {
    if (!value?.start) return 'Date Range'
    const start = new Date(value.start)
    if (!value.end || value.start === value.end) {
      return format(start, 'MMM dd, yyyy')
    }
    const end = new Date(value.end)
    return `${format(start, 'MMM dd, yyyy')} - ${format(end, 'MMM dd, yyyy')}`
  }, [value])

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-[9px] font-black tracking-widest text-muted-foreground/80 uppercase select-none">
        {label}
      </span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center justify-between px-3 h-9 bg-background border rounded-lg text-xs font-semibold text-left select-none transition-all duration-200 outline-none w-full md:w-[260px]",
              open
                ? "border-indigo-600 ring-2 ring-indigo-500/10 shadow-sm"
                : "border-border hover:border-muted-foreground/30 shadow-xs"
            )}
          >
            <span className="flex items-center gap-2 truncate">
              <CalendarIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <span className="truncate">{displayValue}</span>
            </span>
            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200", open && "rotate-180")} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="p-5 w-auto flex flex-col gap-4 shadow-xl border border-border bg-popover rounded-xl"
          align="start"
        >

          {/* Two-month continuous side-by-side calendar rendering */}
          <div className="relative">
            <Calendar
              mode="range"
              selected={range}
              onSelect={handleSelect}
              numberOfMonths={2}
              showOutsideDays={false}
              className="p-0 border-none bg-transparent"
              classNames={{
                months: "flex flex-col md:flex-row gap-6",
                month: "space-y-4",
                caption_label: "text-xs font-black uppercase tracking-wider text-foreground",
                table: "w-full border-collapse space-y-1",
                head_cell: "text-muted-foreground rounded-md w-9 font-bold text-[10px] uppercase tracking-wider",
                cell: "h-9 w-9 text-center text-xs relative p-0 [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                day: cn(
                  "h-9 w-9 p-0 font-normal transition-all rounded-full hover:bg-muted"
                ),
                day_range_start: "bg-indigo-600 text-white rounded-l-md font-bold hover:bg-indigo-600 hover:text-white",
                day_range_end: "bg-indigo-600 text-white rounded-r-md font-bold hover:bg-indigo-600 hover:text-white",
                day_range_middle: "bg-indigo-50 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-100 rounded-none font-medium hover:bg-indigo-100/50",
                day_selected: "bg-indigo-600 text-white font-bold hover:bg-indigo-700",
                day_today: "bg-accent text-accent-foreground font-bold",
                day_outside: "text-muted-foreground/30 opacity-50",
                day_disabled: "text-muted-foreground/30 opacity-50",
                day_hidden: "invisible",
              }}
            />
          </div>

          {/* Clear button footer */}
          {value && (
            <div className="flex items-center justify-end border-t border-border/40 pt-3">
              <button
                type="button"
                onClick={() => {
                  onChange(null)
                  setRange(undefined)
                }}
                className="text-[10px] font-black uppercase tracking-wider text-rose-500 hover:text-rose-600 flex items-center gap-1.5 outline-none transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Clear Range
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
