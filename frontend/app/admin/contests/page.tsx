'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Eye,
  BookOpen,
} from 'lucide-react';
import { useContests } from '@/lib/hooks/useContests';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as contestsApi from '@/lib/api/contests.api';
import { queryKeys } from '@/lib/api/queryClient';
import { toast } from 'sonner';
import { Archive } from 'lucide-react';

export default function ContestsPage() {
  const { contests = [], isLoading } = useContests();
  const queryClient = useQueryClient();

  const [contestToDelete, setContestToDelete] = useState<{ id: string, title: string } | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const deleteContestMutation = useMutation({
    mutationFn: (contestId: string) => contestsApi.deleteContest(contestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contests.list({}) });
      toast.success('Contest deleted successfully');
      setContestToDelete(null);
      setDeleteConfirmText('');
    },
    onError: (err: any) => {
      toast.error(err?.message || 'Failed to delete contest');
    }
  });

  const handleDelete = async () => {
    if (contestToDelete && deleteConfirmText.toLowerCase() === 'delete') {
      deleteContestMutation.mutate(contestToDelete.id);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
          <p className="text-muted-foreground">Loading contests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Section */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Manage Contests</h2>
          <p className="text-muted-foreground">Manage and monitor your contests</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/contests/archived">
            <Button variant="outline" className="gap-2">
              <Archive className="h-4 w-4" />
              Archived
            </Button>
          </Link>
          <Link href="/admin/contests/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Contest
            </Button>
          </Link>
        </div>
      </div>

      <WidgetErrorBoundary name="Contests List">
        <div className="space-y-8">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                All Contests
              </CardTitle>
              <CardDescription>
                A list of all contests in your organization
              </CardDescription>
            </CardHeader>

            <CardContent>
              {contests.length === 0 ? (
                <div className="text-center py-12">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-4">No contests yet</p>
                  <Link href="/admin/contests/create">
                    <Button>Create Your First Contest</Button>
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Participants</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contests.map((contest) => (
                        <TableRow key={contest.id}>
                          <TableCell className="font-medium">{contest.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{contest.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                contest.status === 'active'
                                  ? 'default'
                                  : contest.status === 'published'
                                  ? 'secondary'
                                  : 'outline'
                              }
                            >
                              {contest.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{contest.currentParticipants}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {contest.contestDate ? new Date(contest.contestDate).toLocaleDateString() : 'TBD'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/admin/contests/${contest.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Link href={`/admin/contests/${contest.id}/edit`}>
                                <Button variant="ghost" size="sm">
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                              </Link>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="text-destructive hover:text-destructive"
                                onClick={() => {
                                  setContestToDelete({ id: contest.id, title: contest.title });
                                  setDeleteConfirmText('');
                                }}
                                disabled={deleteContestMutation.isPending && contestToDelete?.id === contest.id}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </WidgetErrorBoundary>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!contestToDelete} onOpenChange={(open) => !open && setContestToDelete(null)}>
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
              value={deleteConfirmText} 
              onChange={(e) => setDeleteConfirmText(e.target.value)} 
            />
          </div>
          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => setContestToDelete(null)}
              disabled={deleteContestMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              disabled={deleteConfirmText.toLowerCase() !== 'delete' || deleteContestMutation.isPending}
              onClick={handleDelete}
            >
              {deleteContestMutation.isPending ? 'Deleting...' : 'Confirm Deletion'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
