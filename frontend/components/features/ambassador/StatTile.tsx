'use client';

import type { ComponentType, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

const TONE_CLASSES = {
  primary: 'bg-primary/12 text-primary',
  accent: 'bg-accent/30 text-accent-foreground',
  success: 'bg-success/12 text-success',
} as const;

interface StatTileProps {
  icon: ComponentType<{ className?: string }>;
  tone: keyof typeof TONE_CLASSES;
  value: ReactNode;
  label: string;
  sub: string;
}

/** One stat card — icon, big number, label, one line of context. Used across the dashboard
 *  overview wherever a handful of top-line numbers need to sit side by side. */
export function StatTile({ icon: Icon, tone, value, label, sub }: StatTileProps) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}
      className="flex items-start gap-3.5 rounded-xl border border-border/50 bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5"
    >
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0', TONE_CLASSES[tone])}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold text-foreground leading-tight tabular-nums">{value}</p>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>
      </div>
    </motion.div>
  );
}
