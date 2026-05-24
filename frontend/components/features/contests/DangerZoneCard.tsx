'use client';

import { useState } from 'react';
import { Trash2, Ban, Archive, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ContestPhase } from '@/lib/types';

import { cn } from '@/lib/utils';

interface DangerZoneCardProps {
  contestTitle: string;
  phase: ContestPhase;
  participantCount: number;
  onDelete: () => Promise<void>;
  onCancel: (reason: string) => Promise<void>;
  onArchive: () => Promise<void>;
  className?: string;
}

export function DangerZoneCard({ 
  contestTitle, 
  phase, 
  participantCount,
  onDelete, 
  onCancel, 
  onArchive,
  className 
}: DangerZoneCardProps) {
  const [isActionInProgress, setIsActionInProgress] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  const isDraft = phase === 'DRAFT';
  const isCancellable = phase === 'PUBLISHED' || phase === 'REGISTRATION_CLOSED' || phase === 'LIVE';
  const isArchivable = phase === 'ENDED' || phase === 'CANCELLED';

  const handleDelete = async () => {
    setIsActionInProgress(true);
    try {
      await onDelete();
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleCancel = async () => {
    setIsActionInProgress(true);
    try {
      await onCancel(cancelReason);
    } finally {
      setIsActionInProgress(false);
    }
  };

  const handleArchive = async () => {
    setIsActionInProgress(true);
    try {
      await onArchive();
    } finally {
      setIsActionInProgress(false);
    }
  };

  return (
    <Card className={cn("border-destructive/20 bg-destructive/5 overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <CardTitle className="text-lg font-bold">Danger Zone</CardTitle>
        </div>
        <CardDescription className="text-destructive/70">
          Destructive actions that cannot be undone easily.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* DRAFT: Delete */}
        {isDraft && (
          <div className="flex flex-col gap-3 p-4 rounded-lg bg-background/50 border border-destructive/10">
            <div className="flex flex-col">
              <span className="text-sm font-bold">Delete Contest</span>
              <span className="text-xs text-muted-foreground">Permanently remove this contest and all its data.</span>
            </div>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full border-destructive/20 text-destructive hover:bg-destructive hover:text-white">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Contest
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This action cannot be reversed. This contest and all its data will be deleted.
                    Please type <strong>delete</strong> to confirm.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input 
                    placeholder="Type delete to confirm" 
                    value={confirmText} 
                    onChange={(e) => setConfirmText(e.target.value)} 
                  />
                </div>
                <DialogFooter>
                  <Button 
                    variant="destructive" 
                    disabled={confirmText.toLowerCase() !== 'delete' || isActionInProgress}
                    onClick={handleDelete}
                  >
                    {isActionInProgress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Deletion
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* PUBLISHED/LIVE: Cancel */}
        {isCancellable && (
          <div className="flex flex-col gap-3 p-4 rounded-lg bg-background/50 border border-destructive/10">
            <div className="flex flex-col">
              <span className="text-sm font-bold">Cancel Contest</span>
              <span className="text-xs text-muted-foreground">Cancel the contest and notify all {participantCount} participants.</span>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Ban className="mr-2 h-4 w-4" />
                  Cancel Contest
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancel Contest</DialogTitle>
                  <DialogDescription>
                    This will notify <strong>{participantCount} participants</strong> about the cancellation.
                    Please provide a reason for the participants.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Textarea 
                    placeholder="Reason for cancellation (sent to participants)" 
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    className="min-h-[100px]"
                  />
                </div>
                <DialogFooter>
                  <Button 
                    variant="destructive" 
                    disabled={!cancelReason.trim() || isActionInProgress}
                    onClick={handleCancel}
                  >
                    {isActionInProgress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Cancellation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* ENDED: Archive */}
        {isArchivable && (
          <div className="flex flex-col gap-3 p-4 rounded-lg bg-background/50 border border-border">
            <div className="flex flex-col">
              <span className="text-sm font-bold">Archive Contest</span>
              <span className="text-xs text-muted-foreground">Hide this contest from the main list but keep its data for records.</span>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Archive className="mr-2 h-4 w-4" />
                  Archive Contest
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Archive Contest?</DialogTitle>
                  <DialogDescription>
                    This contest and all its data will be archived. It will be hidden from the main list but kept for records.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    disabled={isActionInProgress}
                    onClick={handleArchive}
                  >
                    {isActionInProgress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Archive
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}

        {/* COMPLETED/ENDED: Delete (added because we now allow deleting completed) */}
        {isArchivable && !isDraft && (
          <div className="flex flex-col gap-3 p-4 rounded-lg bg-background/50 border border-destructive/10 mt-4">
            <div className="flex flex-col">
              <span className="text-sm font-bold text-destructive">Delete Contest</span>
              <span className="text-xs text-muted-foreground">Permanently remove this contest and all its data.</span>
            </div>
            
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full border-destructive/20 text-destructive hover:bg-destructive hover:text-white">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Contest
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Are you absolutely sure?</DialogTitle>
                  <DialogDescription>
                    This action cannot be reversed. This contest and all its data will be deleted.
                    Please type <strong>delete</strong> to confirm.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input 
                    placeholder="Type delete to confirm" 
                    value={confirmText} 
                    onChange={(e) => setConfirmText(e.target.value)} 
                  />
                </div>
                <DialogFooter>
                  <Button 
                    variant="destructive" 
                    disabled={confirmText.toLowerCase() !== 'delete' || isActionInProgress}
                    onClick={handleDelete}
                  >
                    {isActionInProgress && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Confirm Deletion
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
