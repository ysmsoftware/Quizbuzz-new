import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date helpers
export function isValidDate(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const d = new Date(String(value));
  return !isNaN(d.getTime());
}

export function toDateOrNull(value: unknown): Date | null {
  const d = new Date(String(value));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Splits an array into consecutive chunks of at most `size` items each.
 * Used to turn large bulk-upload payloads into sequential batch requests.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
