'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TypeToConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmWord: string;
  confirmLabel: string;
  destructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmWord,
  confirmLabel,
  destructive = true,
  isLoading = false,
  onConfirm,
}: TypeToConfirmDialogProps) {
  const [text, setText] = useState('');

  const handleOpenChange = (next: boolean) => {
    if (!next) setText('');
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {description} Please type <strong>{confirmWord}</strong> to confirm.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            placeholder={`Type ${confirmWord} to confirm`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            disabled={text.toLowerCase() !== confirmWord.toLowerCase() || isLoading}
            onClick={onConfirm}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
