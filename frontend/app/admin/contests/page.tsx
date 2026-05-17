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
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Eye,
  BookOpen,
} from 'lucide-react';
import { useContests } from '@/lib/hooks/useContests';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { contestService } from '@/lib/services/contest-service';

export default function ContestsPage() {
  const { contests, isLoading } = useContests();

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
        <Link href="/admin/contests/create">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Contest
          </Button>
        </Link>
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
                            {new Date(contest.contestDate).toLocaleDateString()}
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
                              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
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
    </div>
  );
}
