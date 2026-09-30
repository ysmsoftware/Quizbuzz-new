'use client';

import { Activity, AlertCircle, Award, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ContactHistoryItem } from '@/lib/api/crm.api';

const pill = 'gap-1 px-2 py-0.5 text-[10px] font-bold';
const tone = {
  green: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  blue: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  amber: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  red: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  gray: 'bg-secondary text-muted-foreground border-border',
};

export function PaymentBadge({ item }: { item: ContactHistoryItem }) {
  if (!item.contestPrice) {
    return <Badge className={cn(pill, tone.blue)}><ShieldCheck className="h-3 w-3" /> FREE</Badge>;
  }
  const status = item.payment?.status?.toUpperCase() || 'NOT STARTED';
  if (status === 'SUCCESS') {
    return <Badge className={cn(pill, tone.green)}><ShieldCheck className="h-3 w-3" /> PAID</Badge>;
  }
  if (status === 'REFUNDED') {
    return <Badge className={cn(pill, tone.gray)}>REFUNDED</Badge>;
  }
  if (status === 'FAILED' || status === 'CANCELLED') {
    return <Badge className={cn(pill, tone.red)}><AlertCircle className="h-3 w-3" /> {status}</Badge>;
  }
  return <Badge className={cn(pill, tone.amber)}><Activity className="h-3 w-3" /> {status === 'CREATED' ? 'UNPAID' : status}</Badge>;
}

export function CertificateBadge({ certificate }: { certificate?: ContactHistoryItem['certificate'] }) {
  const status = certificate?.status?.toUpperCase();
  if (!status || status === 'PENDING') {
    return <Badge variant="outline" className={pill}><AlertCircle className="h-3 w-3" /> Not issued</Badge>;
  }
  if (status === 'GENERATED' || status === 'ISSUED') {
    return <Badge className={cn(pill, tone.green)}><Award className="h-3 w-3" /> {certificate?.deliveredAt ? 'Delivered' : 'Generated'}</Badge>;
  }
  if (status === 'FAILED') {
    return <Badge className={cn(pill, tone.red)}><AlertCircle className="h-3 w-3" /> Failed</Badge>;
  }
  return <Badge className={cn(pill, tone.amber)}><Activity className="h-3 w-3" /> Processing</Badge>;
}

const STATUS_TONE: Record<string, keyof typeof tone> = {
  SUBMITTED: 'green',
  REGISTERED: 'blue',
  CHECKED_IN: 'blue',
  IN_WAITING: 'blue',
  IN_QUIZ: 'amber',
  PENDING_PAYMENT: 'amber',
  DISQUALIFIED: 'red',
  ABSENT: 'gray',
};

export function ParticipantStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn(pill, 'uppercase tracking-wide', tone[STATUS_TONE[status] ?? 'gray'])}>
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

export const formatInr = (n?: number | null) =>
  n == null ? '—' : `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export const initials = (first?: string | null, last?: string | null) =>
  `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?';
