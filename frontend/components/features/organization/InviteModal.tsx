'use client';

import { useState } from 'react';
import { Mail, Check, Copy, Shield, Eye, ArrowRight, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export interface InviteSuccessData {
  email: string;
  role: string;
  inviteLink: string;
}

interface InviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (email: any, role: any) => Promise<InviteSuccessData | void>;
  isLoading?: boolean;
}

export function InviteModal({
  open,
  onOpenChange,
  onInvite,
  isLoading = false,
}: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'VIEWER'>('ADMIN');
  const [error, setError] = useState<string | null>(null);
  
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [successData, setSuccessData] = useState<InviteSuccessData | null>(null);
  const [copied, setCopied] = useState(false);

  const resetForm = () => {
    setEmail('');
    setRole('ADMIN');
    setError(null);
    setStep('form');
    setSuccessData(null);
    setCopied(false);
  };

  const handleModalClose = (isOpen: boolean) => {
    if (!isOpen) {
      resetForm();
    }
    onOpenChange(isOpen);
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Please enter a valid email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address (e.g. name@company.com).');
      return;
    }

    try {
      let res: any;
      try {
        res = await onInvite(trimmedEmail, role);
      } catch (err: any) {
        // If caller expects an array of emails
        res = await onInvite([trimmedEmail], role);
      }
      if (res && res.inviteLink) {
        setSuccessData(res);
        setStep('success');
      } else {
        toast.success(`Invitation successfully sent to ${trimmedEmail}`);
        handleModalClose(false);
      }
    } catch (err: any) {
      console.error('Invite member error:', err);
      setError(err?.message || 'Failed to send invitation. Please try again.');
    }
  };

  const handleCopyLink = () => {
    if (!successData?.inviteLink) return;
    navigator.clipboard.writeText(successData.inviteLink);
    setCopied(true);
    toast.success('Invitation link copied to clipboard!');
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <Dialog open={open} onOpenChange={handleModalClose}>
      <DialogContent className="sm:max-w-md">
        {step === 'form' ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                <Mail className="h-5 w-5 text-primary" />
                <span>Invite Team Member</span>
              </DialogTitle>
              <DialogDescription>
                Invite a registered QuizBuzz admin to join your organization context.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleInviteSubmit} className="space-y-5 pt-2">
              {/* Email Address */}
              <div className="space-y-2">
                <Label htmlFor="member-email" className="text-sm font-semibold">
                  Email Address <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="member-email"
                  type="email"
                  placeholder="admin@organization.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  disabled={isLoading}
                  className={error ? 'border-destructive focus-visible:ring-destructive' : ''}
                  required
                />
                {error ? (
                  <p className="text-xs font-medium text-destructive mt-1.5">{error}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Must correspond to an existing QuizBuzz Admin user account.
                  </p>
                )}
              </div>

              {/* Role Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Assign Role</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(v) => setRole(v as 'ADMIN' | 'VIEWER')}
                  className="grid grid-cols-1 gap-3"
                >
                  <div className="flex items-start space-x-3 rounded-lg border border-border p-3 hover:bg-accent/40 transition-colors cursor-pointer">
                    <RadioGroupItem value="ADMIN" id="role-admin" className="mt-1" />
                    <div className="space-y-0.5">
                      <Label htmlFor="role-admin" className="font-semibold cursor-pointer flex items-center gap-1.5 text-sm">
                        <Shield className="h-4 w-4 text-blue-500" />
                        <span>Admin</span>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Can create & manage contests, questions, participants, and settings.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border border-border p-3 hover:bg-accent/40 transition-colors cursor-pointer">
                    <RadioGroupItem value="VIEWER" id="role-viewer" className="mt-1" />
                    <div className="space-y-0.5">
                      <Label htmlFor="role-viewer" className="font-semibold cursor-pointer flex items-center gap-1.5 text-sm">
                        <Eye className="h-4 w-4 text-slate-500" />
                        <span>Viewer</span>
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Read-only access to view contest reports, leaderboards, and member lists.
                      </p>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleModalClose(false)}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="gap-2"
                >
                  {isLoading ? 'Sending Invite...' : 'Send Invite'}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </>
        ) : (
          <>
            <DialogHeader className="text-center sm:text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 mb-2">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <DialogTitle className="text-xl font-bold text-center">
                Invitation Sent!
              </DialogTitle>
              <DialogDescription className="text-center">
                An invitation email has been sent to <span className="font-semibold text-foreground">{successData?.email}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 py-2">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-800 dark:text-emerald-300">
                <p>
                  The member will receive an email containing a join link. You can also copy and share the link directly below:
                </p>
              </div>

              {/* Copy Link Section */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Invitation Link
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={successData?.inviteLink || ''}
                    className="font-mono text-xs bg-muted/50 select-all pr-2"
                  />
                  <Button
                    type="button"
                    variant={copied ? 'default' : 'outline'}
                    size="sm"
                    onClick={handleCopyLink}
                    className="shrink-0 gap-1.5"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-emerald-500" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Success Modal Footer Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForm}
                  className="flex-1"
                >
                  Invite Another Member
                </Button>
                <Button
                  type="button"
                  onClick={() => handleModalClose(false)}
                  className="flex-1"
                >
                  Done
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
