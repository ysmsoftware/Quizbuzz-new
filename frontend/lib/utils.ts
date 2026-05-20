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
