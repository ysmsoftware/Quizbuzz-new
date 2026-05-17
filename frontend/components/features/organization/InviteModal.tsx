import { useState } from 'react';
import { Mail, X } from 'lucide-react';
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
import { TeamRole } from '@/lib/types';

interface InviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvite: (emails: string[], role: TeamRole) => Promise<void>;
  isLoading?: boolean;
}

export function InviteModal({
  open,
  onOpenChange,
  onInvite,
  isLoading = false,
}: InviteModalProps) {
  const [emails, setEmails] = useState<string[]>(['']);
  const [role, setRole] = useState<TeamRole>('editor');
  const [error, setError] = useState<string | null>(null);

  const handleEmailChange = (index: number, value: string) => {
    const newEmails = [...emails];
    newEmails[index] = value;
    setEmails(newEmails);
  };

  const addEmailField = () => {
    setEmails([...emails, '']);
  };

  const removeEmailField = (index: number) => {
    setEmails(emails.filter((_, i) => i !== index));
  };

  const handleInvite = async () => {
    setError(null);

    const validEmails = emails.filter(e => e.trim());
    if (validEmails.length === 0) {
      setError('Please enter at least one email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = validEmails.filter(e => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      setError(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      return;
    }

    try {
      await onInvite(validEmails, role);
      setEmails(['']);
      setRole('editor');
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitations');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>
            Add new team members to your organization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Email Fields */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Email Address(es)</label>
            {emails.map((email, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  type="email"
                  placeholder="member@example.com"
                  value={email}
                  onChange={(e) => handleEmailChange(index, e.target.value)}
                  disabled={isLoading}
                />
                {emails.length > 1 && (
                  <button
                    onClick={() => removeEmailField(index)}
                    className="px-3 py-2 hover:bg-muted rounded"
                    disabled={isLoading}
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={addEmailField}
            disabled={isLoading}
            className="w-full"
          >
            <Mail className="h-4 w-4 mr-2" />
            Add Another Email
          </Button>

          {/* Role Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Role</label>
            <RadioGroup value={role} onValueChange={(v) => setRole(v as TeamRole)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="admin" id="admin" />
                <Label htmlFor="admin" className="font-normal cursor-pointer">
                  Admin - Full access to all settings
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="editor" id="editor" />
                <Label htmlFor="editor" className="font-normal cursor-pointer">
                  Editor - Can create and manage contests
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="viewer" id="viewer" />
                <Label htmlFor="viewer" className="font-normal cursor-pointer">
                  Viewer - Read-only access
                </Label>
              </div>
            </RadioGroup>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Sending...' : 'Send Invitations'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
