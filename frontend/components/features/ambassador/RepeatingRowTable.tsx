'use client';

import { useState } from 'react';
import { ChevronsUpDown, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

/** Editable "type or pick a suggestion" cell for `combobox` columns — free text is always
 *  accepted (typed directly into the input), and the popover below it offers the column's
 *  suggestions as one-click fills. Replaces a previous `<Input list=…>` + `<datalist>`
 *  implementation: that gave no visible dropdown affordance (nothing to click — you had to
 *  know to start typing to trigger the browser's native suggestion popup) and, worse, sat
 *  inside this table's `overflow-x-auto` wrapper below, which Chromium clips a `<datalist>`
 *  popup against. This uses the same Popover primitive the rest of the app already relies on
 *  for dropdowns — it portals to `document.body` (see `PopoverContent`), so it isn't clipped
 *  by this table's horizontal scroll container the way the native datalist was. */
function ComboboxCell({
  value,
  options,
  placeholder,
  error,
  onChange,
}: {
  value: string;
  options: string[];
  placeholder?: string;
  error?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          {/* No onFocus-triggered open here: Popover's asChild trigger already opens on
              click (Radix's own click handler on this wrapper), and pairing that with an
              onFocus-driven setOpen(true) would race it — focus fires before click, so the
              click's toggle would immediately re-close what focus just opened. Clicking into
              the field (or its chevron) opens the suggestions; typing always works regardless
              of whether the popover is open. */}
          <Input
            className={cn('h-8 pr-6', error && 'border-destructive focus-visible:ring-destructive/20')}
            placeholder={placeholder}
            value={value}
            aria-invalid={error}
            onChange={(e) => onChange(e.target.value)}
          />
          <ChevronsUpDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        </div>
      </PopoverTrigger>
      {options.length > 0 && (
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-1"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="flex flex-col">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={cn(
                  'rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted',
                  opt === value && 'bg-muted font-medium',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}

export interface RepeatingRowColumn<T> {
  key: keyof T;
  label: string;
  type: 'text' | 'number' | 'select' | 'combobox';
  options?: string[]; // for 'select': the only allowed values; for 'combobox': suggestions only, free text still accepted
  placeholder?: string;
}

interface RepeatingRowTableProps<T> {
  rows: T[];
  columns: RepeatingRowColumn<T>[];
  onChange: (rows: T[]) => void;
  newRow: () => T;
  addLabel?: string;
  /** Per-cell validation message, e.g. from a dot-path error map keyed "amountPerRegistration" for row index i. */
  getCellError?: (rowIndex: number, key: keyof T) => string | undefined;
  /** Validation message for the array itself (e.g. "Add at least one tier"), shown above the Add button. */
  arrayError?: string;
}

/** Small repeating-row editor: Table + inline Input/Select cells, add/remove rows. Reused across the
 * reward-config editor's three sections (milestone tiers, speed bonus tiers, leaderboard prize ranks). */
 
export function RepeatingRowTable<T extends Record<string, any>>({
  rows,
  columns,
  onChange,
  newRow,
  addLabel = 'Add row',
  getCellError,
  arrayError,
}: RepeatingRowTableProps<T>) {
  const updateCell = (index: number, key: keyof T, value: string | number) => {
    const next = [...rows];
    next[index] = { ...next[index], [key]: value };
    onChange(next);
  };

  const removeRow = (index: number) => onChange(rows.filter((_, i) => i !== index));

  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border/50">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={String(col.key)}>{col.label}</TableHead>
                ))}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index}>
                  {columns.map((col) => {
                    const cellError = getCellError?.(index, col.key);
                    return (
                      <TableCell key={String(col.key)} className="min-w-[120px] align-top">
                        {col.type === 'select' ? (
                          <Select
                            value={row[col.key] ? String(row[col.key]) : ''}
                            onValueChange={(v) => updateCell(index, col.key, v)}
                          >
                            <SelectTrigger className={cn('h-8', cellError && 'border-destructive')}>
                              <SelectValue placeholder={col.placeholder} />
                            </SelectTrigger>
                            <SelectContent>
                              {(col.options ?? []).map((opt) => (
                                <SelectItem key={opt} value={opt}>
                                  {opt}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : col.type === 'combobox' ? (
                          <ComboboxCell
                            value={row[col.key] ? String(row[col.key]) : ''}
                            options={col.options ?? []}
                            placeholder={col.placeholder}
                            error={!!cellError}
                            onChange={(v) => updateCell(index, col.key, v)}
                          />
                        ) : (
                          <Input
                            className={cn('h-8', cellError && 'border-destructive focus-visible:ring-destructive/20')}
                            type={col.type}
                            placeholder={col.placeholder}
                            value={row[col.key] ?? ''}
                            aria-invalid={!!cellError}
                            onChange={(e) =>
                              updateCell(index, col.key, col.type === 'number' ? Number(e.target.value) : e.target.value)
                            }
                          />
                        )}
                        {cellError && <p className="text-xs text-destructive mt-1">{cellError}</p>}
                      </TableCell>
                    );
                  })}
                  <TableCell className="align-top">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => removeRow(index)} aria-label="Remove row">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {arrayError && <p className="text-sm text-destructive">{arrayError}</p>}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...rows, newRow()])}>
        <Plus className="h-4 w-4 mr-2" />
        {addLabel}
      </Button>
    </div>
  );
}
