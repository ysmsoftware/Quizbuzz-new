'use client'

import * as React from 'react'
import { format } from 'date-fns'
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

export interface DatePickerProps {
  value?: Date
  onChange?: (date?: Date) => void
  placeholder?: string
  className?: string
  align?: 'center' | 'end' | 'start'
  disabled?: boolean
}

export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  className,
  align = 'start',
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (selectedDate: Date | undefined) => {
    onChange?.(selectedDate)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          data-empty={!value}
          className={cn(
            "flex items-center justify-between px-3 h-9 bg-background border border-border rounded-lg text-xs font-semibold text-left select-none transition-all duration-200 outline-none w-full md:w-[212px]",
            open && "border-indigo-600 ring-2 ring-indigo-500/10 shadow-sm",
            !value && "text-muted-foreground",
            className
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <CalendarIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate">{value ? format(value, "PPP") : placeholder}</span>
          </span>
          <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200", open && "rotate-180")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-3 w-auto shadow-xl border border-border bg-popover rounded-xl"
        align={align}
      >
        <Calendar
          mode="single"
          selected={value}
          onSelect={handleSelect}
          defaultMonth={value}
          showOutsideDays={true}
          className="p-1 border-none bg-transparent"
          classNames={{
            month_caption: "flex items-center justify-center h-9 w-full relative mb-4",
            caption_label: "text-xs font-black uppercase tracking-wider text-foreground select-none",
            nav: "flex items-center justify-between w-full absolute top-0 inset-x-0 z-20 pointer-events-none px-1",
            button_previous: "h-7 w-7 rounded-full border border-border/40 hover:border-indigo-500 hover:bg-muted/30 flex items-center justify-center transition-all cursor-pointer pointer-events-auto",
            button_next: "h-7 w-7 rounded-full border border-border/40 hover:border-indigo-500 hover:bg-muted/30 flex items-center justify-center transition-all cursor-pointer pointer-events-auto",
            table: "w-full border-collapse space-y-1",
            head_cell: "text-muted-foreground/80 w-8 font-bold text-[10px] uppercase tracking-wider text-center py-2 select-none",
            cell: "h-8 w-8 text-center text-xs relative p-0 focus-within:relative focus-within:z-20",
            day: cn(
              "h-8 w-8 p-0 font-normal transition-all rounded-full hover:bg-muted/50 cursor-pointer flex items-center justify-center"
            ),
            day_selected: "bg-indigo-600 text-white font-bold hover:bg-indigo-700 rounded-full",
            day_today: "bg-accent/40 text-accent-foreground font-bold",
            day_outside: "text-muted-foreground/30 opacity-40",
            day_disabled: "text-muted-foreground/20 opacity-30 cursor-not-allowed",
            day_hidden: "invisible",
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
