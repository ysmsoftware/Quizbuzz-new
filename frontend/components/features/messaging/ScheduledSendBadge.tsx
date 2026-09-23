'use client';

import { CalendarClock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SchedulableMessage {
  status: string;
  scheduledFor?: string | null;
  statusReason?: string | null;
}

/** QUEUED with a booked future send slot — deferred by the mailbox's hourly email cap. */
export function isAwaitingSlot(msg: SchedulableMessage): boolean {
  return msg.status === 'QUEUED' && !!msg.scheduledFor && new Date(msg.scheduledFor).getTime() > Date.now();
}

/** "Scheduled · 2:05 PM" with the reason under it (full reason on hover). */
export function ScheduledSendBadge({ message }: { message: SchedulableMessage }) {
  const at = new Date(message.scheduledFor!);
  const sameDay = at.toDateString() === new Date().toDateString();
  const label = at.toLocaleString([], sameDay ? { hour: 'numeric', minute: '2-digit' } : { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  return (
    <div className="space-y-0.5" title={message.statusReason ?? undefined}>
      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1.5">
        <CalendarClock className="h-3 w-3" /> Scheduled · {label}
      </Badge>
      <p className="text-[10px] text-muted-foreground">Hourly email limit reached</p>
    </div>
  );
}
