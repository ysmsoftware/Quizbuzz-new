'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PRESET_REASONS = [
  {
    value: 'tab_switching',
    label: 'Proctoring violation — tab switching',
    text: 'Repeated tab-switching / window-focus violations detected during proctoring review.',
  },
  {
    value: 'unauthorized_device',
    label: 'Unauthorized device / external assistance',
    text: 'Use of an unauthorized device or external assistance detected during proctoring review.',
  },
  {
    value: 'identity_mismatch',
    label: 'Identity mismatch',
    text: "Participant identity could not be verified against registration details.",
  },
  {
    value: 'academic_integrity',
    label: 'Academic integrity violation',
    text: 'Academic integrity violation identified during audit of the submission/session.',
  },
  { value: 'other', label: 'Other (specify below)', text: '' },
] as const;

const MIN_REASON_LENGTH = 5;
const MAX_REASON_LENGTH = 500;

interface DisqualifyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
  /** When set, phrases the dialog for a bulk action (e.g. 3 participants). */
  participantCount?: number;
}

export function DisqualifyDialog({ open, onOpenChange, onConfirm, isPending, participantCount }: DisqualifyDialogProps) {
  const [preset, setPreset] = useState<string>('');
  const [reason, setReason] = useState('');

  const isBulk = !!participantCount && participantCount > 1;
  const trimmed = reason.trim();
  const isValid = trimmed.length >= MIN_REASON_LENGTH;

  // Fresh reason/preset each time the dialog opens — covers both a
  // parent-initiated close (e.g. after a successful mutation) and Cancel.
  useEffect(() => {
    if (open) {
      setPreset('');
      setReason('');
    }
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && isPending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {isBulk ? `Disqualify ${participantCount} Participants` : 'Disqualify Participant'}
          </DialogTitle>
          <DialogDescription>
            This action is permanent and cannot be undone. {isBulk ? 'Their' : "The participant's"} score will be
            invalidated and {isBulk ? 'they' : 'they'} will be marked as disqualified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Reason</label>
            <Select
              value={preset}
              onValueChange={(value) => {
                setPreset(value);
                const found = PRESET_REASONS.find((p) => p.value === value);
                if (found && found.text) setReason(found.text);
                if (value === 'other') setReason('');
              }}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a reason (optional)" />
              </SelectTrigger>
              <SelectContent>
                {PRESET_REASONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Reason for disqualification <span className="text-destructive">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Detected use of an external device, repeated tab-switching violations..."
              rows={3}
              maxLength={MAX_REASON_LENGTH}
              disabled={isPending}
              className={cn(trimmed.length > 0 && !isValid ? 'border-destructive focus-visible:ring-destructive' : '')}
            />
            {trimmed.length > 0 && !isValid ? (
              <p className="text-xs text-destructive">Reason must be at least {MIN_REASON_LENGTH} characters.</p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Recorded on {isBulk ? 'each participant' : "the participant's"} record and included in their notification email.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!isValid || isPending} onClick={() => onConfirm(trimmed)}>
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Disqualifying...
              </>
            ) : (
              'Confirm Disqualification'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
