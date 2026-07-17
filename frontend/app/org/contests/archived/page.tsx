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
  ArrowLeft,
  Eye,
  Archive,
} from 'lucide-react';
import { useArchivedContests } from '@/lib/hooks/useContests';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

export default function ArchivedContestsPage() {
  const { contests = [], isLoading } = useArchivedContests();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="inline-block">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
          <p className="text-muted-foreground">Loading archived contests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Top Section */}
      <div className="flex items-center gap-4">
        <Link href="/org/contests">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-3xl font-bold">Archived Contests</h2>
          <p className="text-muted-foreground">View your archived contests</p>
        </div>
      </div>

      <WidgetErrorBoundary name="Archived Contests List">
        <div className="space-y-8">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Archive className="h-5 w-5" />
                Archive Folder
              </CardTitle>
              <CardDescription>
                A list of all archived contests in your organization
              </CardDescription>
            </CardHeader>

            <CardContent>
              {contests.length === 0 ? (
                <div className="text-center py-12">
                  <Archive className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground mb-4">No archived contests</p>
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
                            <Badge variant="outline">{contest.category || contest.topic || contest.tags?.[0]}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {contest.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{contest.currentParticipants || contest._count?.participants || 0}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {contest.startTime ? new Date(contest.startTime).toLocaleDateString() : 'TBD'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Link href={`/org/contests/${contest.id}`}>
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
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
    </div>
  );
}
