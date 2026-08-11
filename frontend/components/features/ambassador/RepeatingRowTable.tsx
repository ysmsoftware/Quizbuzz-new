'use client';

import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface RepeatingRowColumn<T> {
  key: keyof T;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- row shapes vary (some fields are nested objects like `goodie`); only the columns array is type-checked per field.
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
