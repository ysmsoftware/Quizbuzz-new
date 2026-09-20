'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

export interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

// Catalogs like colleges run to ~3k rows. Mounting all of them (and letting cmdk fuzzy-score
// every one per keystroke) is what made the dropdown lag, so only a page of matches is rendered.
const MAX_RESULTS = 50;

// Options whose value starts with "__" (the "Other (not listed)" sentinel, `__OTHER__`) are
// escape hatches, not catalog entries: always shown after the matches, never capped or filtered out.
const isPinned = (o: ComboboxOption) => o.value.startsWith('__');

// Lowercased, punctuation folded to spaces, so "K. K Wagh" matches "K.K. Wagh Institute".
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  emptyText = 'No options found.',
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const listRef = React.useRef<HTMLDivElement>(null);

  const selectedOption = React.useMemo(() => {
    return options.find((opt) => opt.value.toLowerCase() === (value || '').toLowerCase());
  }, [options, value]);

  const { matches, pinned, total } = React.useMemo(() => {
    const tokens = normalize(search).split(' ').filter(Boolean);
    const catalog = options.filter((o) => !isPinned(o));
    const found = tokens.length
      ? catalog.filter((o) => {
          const haystack = normalize(o.label);
          return tokens.every((t) => haystack.includes(t));
        })
      : catalog;
    return { matches: found.slice(0, MAX_RESULTS), pinned: options.filter(isPinned), total: found.length };
  }, [options, search]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSearch('');
  };

  const handleSearchChange = (next: string) => {
    setSearch(next);
    // The list keeps its old scrollTop across a re-filter, which left the best matches scrolled
    // out of view above the fold — always start a new search from the top.
    if (listRef.current) listRef.current.scrollTop = 0;
  };

  const renderItem = (option: ComboboxOption) => {
    const isSelected = (value || '').toLowerCase() === option.value.toLowerCase();
    return (
      <CommandItem
        key={option.value}
        value={option.value}
        onSelect={() => {
          handleOpenChange(false);
          if (isSelected) return;
          onChange(option.value);
        }}
        className="flex items-start justify-between gap-2 cursor-pointer"
      >
        <span className="line-clamp-2 min-w-0 flex-1">{option.label}</span>
        <Check
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0',
            isSelected ? 'opacity-100 text-primary' : 'opacity-0'
          )}
        />
      </CommandItem>
    );
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange} modal>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal bg-background text-left shadow-xs transition-colors',
            !value && 'text-muted-foreground',
            className
          )}
        >
          <span className="truncate">{selectedOption ? selectedOption.label : value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-(--radix-popover-trigger-width) p-0"
        align="start"
        collisionPadding={8}
        // On touch devices, autofocusing the search box raises the keyboard over the bottom of the
        // screen, leaving the list a sliver to scroll in. Open with the list fully visible instead;
        // tapping the search box still focuses it.
        onOpenAutoFocus={(e) => {
          if (window.matchMedia('(pointer: coarse)').matches) e.preventDefault();
        }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            className="h-9"
            value={search}
            onValueChange={handleSearchChange}
          />
          {/* Capped to the room Radix says is actually left, so the list never runs off-screen
              (e.g. when the popover flips above the trigger on a phone). */}
          <CommandList
            ref={listRef}
            className="max-h-[min(15rem,calc(var(--radix-popover-content-available-height)-3rem))] overscroll-contain"
          >
            <CommandGroup>
              {matches.map(renderItem)}
              {matches.length === 0 && (
                <div className="py-4 text-center text-sm text-muted-foreground">{emptyText}</div>
              )}
              {total > matches.length && (
                <div className="px-2 py-1.5 text-center text-xs text-muted-foreground">
                  Showing {matches.length} of {total} — type to narrow down
                </div>
              )}
              {pinned.map(renderItem)}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
