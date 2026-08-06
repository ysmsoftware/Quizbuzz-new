'use client';

import { useMemo, useState } from 'react';
import { CalendarClock, AlertTriangle, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useRescheduleContest } from '@/lib/hooks/useContestLifecycle';

interface RescheduleContestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contestId: string;
  contestTitle: string;
  startTime: string | Date;
  registrationDeadline: string | Date;
  durationMinutes: number;
  registeredCount?: number;
}

/** `<input type="datetime-local">` needs a local-time string, not an ISO/UTC one. */
function toLocalInputValue(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRelative(ms: number): string {
  if (ms <= 0) return 'in the past';
  const totalMinutes = Math.round(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes || parts.length === 0) parts.push(`${minutes}m`);
  return `in ${parts.join(' ')}`;
}

export function RescheduleContestModal({
  open,
  onOpenChange,
  contestId,
  contestTitle,
  startTime,
  registrationDeadline,
  durationMinutes,
  registeredCount = 0,
}: RescheduleContestModalProps) {
  const [start, setStart] = useState(() => toLocalInputValue(startTime));
  const [deadline, setDeadline] = useState(() => toLocalInputValue(registrationDeadline));
  const [duration, setDuration] = useState(String(durationMinutes));
  const [reason, setReason] = useState('');
  const [notify, setNotify] = useState(true);

  const mutation = useRescheduleContest(contestId);

  // Live preview of the schedule the admin is actually about to commit. This exists
  // to catch the "set it an hour off and only notice from the participant side"
  // mistake before it is submitted, not merely to look informative.
  const preview = useMemo(() => {
    const startDate = new Date(start);
    const deadlineDate = new Date(deadline);
    const mins = parseInt(duration, 10);

    if (Number.isNaN(startDate.getTime())) {
      return { error: 'Enter a valid start date and time.' as string | null, lines: [] as string[] };
    }
    if (!mins || mins < 10 || mins > 480) {
      return { error: 'Duration must be between 10 and 480 minutes.', lines: [] };
    }
    if (startDate.getTime() <= Date.now()) {
      return { error: 'Start time must be in the future.', lines: [] };
    }
    if (!Number.isNaN(deadlineDate.getTime()) && deadlineDate.getTime() >= startDate.getTime()) {
      return { error: 'Registration must close before the contest starts.', lines: [] };
    }

    const endDate = new Date(startDate.getTime() + mins * 60000);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const fmt = (d: Date) => d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

    return {
      error: null,
      lines: [
        `Starts ${fmt(startDate)} — ${formatRelative(startDate.getTime() - Date.now())}`,
        `Ends ${fmt(endDate)} (${mins} min)`,
        !Number.isNaN(deadlineDate.getTime()) ? `Registration closes ${fmt(deadlineDate)}` : '',
        `Times shown in ${tz}`,
      ].filter(Boolean),
    };
  }, [start, deadline, duration]);

  const handleSubmit = async () => {
    if (preview.error) return;
    try {
      await mutation.mutateAsync({
        startTime: new Date(start).toISOString(),
        registrationDeadline: deadline ? new Date(deadline).toISOString() : undefined,
        duration: parseInt(duration, 10),
        reason: reason.trim() || undefined,
        notifyParticipants: notify,
      });
      toast.success(
        notify && registeredCount > 0
          ? `Contest rescheduled — notifying ${registeredCount} participant${registeredCount === 1 ? '' : 's'}`
          : 'Contest rescheduled',
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reschedule contest');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !mutation.isPending && onOpenChange(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Reschedule contest
          </DialogTitle>
          <DialogDescription>
            Set the new schedule for &ldquo;{contestTitle}&rdquo;. All timer jobs and reminders are
            rebuilt from these values.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-start">Start date &amp; time</Label>
              <Input
                id="reschedule-start"
                type="datetime-local"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reschedule-duration">Duration (minutes)</Label>
              <Input
                id="reschedule-duration"
                type="number"
                min={10}
                max={480}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reschedule-deadline">Registration closes</Label>
            <Input
              id="reschedule-deadline"
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>

          {/* Derived schedule preview */}
          {preview.error ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{preview.error}</span>
            </div>
          ) : (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-1">
              {preview.lines.map((line, i) => (
                <p
                  key={i}
                  className={i === 0 ? 'text-sm font-semibold text-foreground' : 'text-xs text-muted-foreground'}
                >
                  {line}
                </p>
              ))}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reschedule-reason">Reason (shown to participants)</Label>
            <Textarea
              id="reschedule-reason"
              placeholder="e.g. Venue network maintenance"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="min-h-[72px]"
            />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 cursor-pointer">
            <Checkbox
              checked={notify}
              onCheckedChange={(v) => setNotify(v === true)}
              className="mt-0.5"
            />
            <span className="space-y-0.5">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Users className="h-3.5 w-3.5" />
                Notify {registeredCount} registered participant{registeredCount === 1 ? '' : 's'}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Uncheck for a quick correction shortly after publishing.
              </span>
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!!preview.error || mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Rescheduling...
              </>
            ) : (
              'Confirm reschedule'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
