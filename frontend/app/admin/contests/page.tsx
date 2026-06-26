'use client';

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
  Plus,
  BookOpen,
  Archive,
} from 'lucide-react';
import { useContests } from '@/lib/hooks/useContests';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

export default function ContestsPage() {
  const { contests = [], isLoading } = useContests();
  const router = useRouter();

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
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contests.map((contest) => (
                        <TableRow
                          key={contest.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/admin/contests/${contest.id}`)}
                        >
                          <TableCell className="font-medium">{contest.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{contest.category}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                contest.status?.toLowerCase() === 'active'
                                  ? 'default'
                                  : contest.status?.toLowerCase() === 'published'
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
    </div>
  );
}
