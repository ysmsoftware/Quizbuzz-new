'use client';

import { cn } from '@/lib/utils';

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

interface ChipSelectProps<T extends string> {
  options: ChipOption<T>[];
  value: T | T[] | null;
  onChange: (v: T) => void;
  multi?: boolean;
}

export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
  multi = false,
}: ChipSelectProps<T>) {
  const selected = multi
    ? (Array.isArray(value) ? value : [])
    : value
      ? [value as T]
      : [];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const isActive = selected.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              'px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 cursor-pointer',
              isActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-secondary/60 text-muted-foreground border-border hover:border-primary/40 hover:text-foreground hover:bg-secondary'
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
