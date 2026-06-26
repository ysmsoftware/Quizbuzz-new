'use client';

import { useState } from 'react';
import { MoreVertical, CheckCircle2, Archive, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { TypeToConfirmDialog } from './TypeToConfirmDialog';
import { toast } from 'sonner';

interface ContestMoreMenuProps {
  contestTitle: string;
  serverStatus: string;
  onComplete: () => Promise<void>;
  onArchive: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ContestMoreMenu({
  contestTitle,
  serverStatus,
  onComplete,
  onArchive,
  onDelete,
}: ContestMoreMenuProps) {
  const [isCompleteOpen, setIsCompleteOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isWorking, setIsWorking] = useState(false);

  const canComplete = serverStatus === 'RESULTS_OUT';
  const canArchive = serverStatus !== 'LIVE';
  const canDelete = serverStatus === 'DRAFT' || serverStatus === 'COMPLETED';

  const handleComplete = async () => {
    setIsWorking(true);
    try {
      await onComplete();
      toast.success('Contest marked as completed');
      setIsCompleteOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to complete contest');
    } finally {
      setIsWorking(false);
    }
  };

  const handleArchive = async () => {
    setIsWorking(true);
    try {
      await onArchive();
      toast.success('Contest archived');
      setIsArchiveOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to archive contest');
    } finally {
      setIsWorking(false);
    }
  };

  const handleDelete = async () => {
    setIsWorking(true);
    try {
      await onDelete();
      toast.success('Contest deleted');
      setIsDeleteOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete contest');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            disabled={!canComplete}
            onClick={() => setIsCompleteOpen(true)}
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Complete Contest
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!canArchive}
            onClick={() => setIsArchiveOpen(true)}
          >
            <Archive className="mr-2 h-4 w-4" />
            Archive Contest
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!canDelete}
            className="text-destructive focus:text-destructive"
            onClick={() => setIsDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Contest
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Complete confirmation — simple, non-destructive */}
      <AlertDialog open={isCompleteOpen} onOpenChange={setIsCompleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark "{contestTitle}" as completed?</AlertDialogTitle>
            <AlertDialogDescription>
              This closes out the contest lifecycle. Certificates and final records will be locked in. This contest can then be deleted if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isWorking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleComplete} disabled={isWorking}>
              {isWorking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark as Completed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive — two-factor confirmation */}
      <TypeToConfirmDialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        title="Archive this contest?"
        description="This contest and all its data will be archived. It will be hidden from the main list but kept for records."
        confirmWord="archive"
        confirmLabel="Confirm Archive"
        destructive={false}
        isLoading={isWorking}
        onConfirm={handleArchive}
      />

      {/* Delete — two-factor confirmation */}
      <TypeToConfirmDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Are you absolutely sure?"
        description="This action cannot be reversed. This contest and all its data will be deleted."
        confirmWord="delete"
        confirmLabel="Confirm Deletion"
        destructive
        isLoading={isWorking}
        onConfirm={handleDelete}
      />
    </>
  );
}
