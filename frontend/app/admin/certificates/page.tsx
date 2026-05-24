'use client';

import Link from 'next/link';
import { useContests } from '@/lib/hooks/useContests';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Award, ChevronLeft, BookOpen, Eye, ArrowRight } from 'lucide-react';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';

export default function AdminCertificatesPage() {
    const { contests = [], isLoading } = useContests();

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
        <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3 text-primary">
                        <Award className="h-6 w-6" />
                        <h1 className="text-3xl font-bold">Certificates</h1>
                    </div>
                    <p className="text-muted-foreground max-w-2xl">
                        Manage certificates by contest. Select a contest below to view existing issued certificates, retry failed generation, and bulk issue new certificates.
                    </p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button variant="outline" asChild className="rounded-xl h-11">
                        <Link href="/admin/contests">
                            <ChevronLeft className="mr-2 h-4 w-4" /> Back to Contests
                        </Link>
                    </Button>
                    <Button asChild className="rounded-xl h-11 bg-primary text-primary-foreground">
                        <Link href="/admin/contests">Contest Dashboard</Link>
                    </Button>
                </div>
            </div>

            <WidgetErrorBoundary name="Certificate Contests List">
                <Card className="border-border/50">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <BookOpen className="h-5 w-5" />
                            Contests with certificate management
                        </CardTitle>
                        <CardDescription>
                            Select a contest to open its certificate management page.
                        </CardDescription>
                    </CardHeader>

                    <CardContent>
                        {contests.length === 0 ? (
                            <div className="text-center py-12">
                                <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                                <p className="text-muted-foreground mb-4">No contests found.</p>
                                <Link href="/admin/contests/create">
                                    <Button>Create your first contest</Button>
                                </Link>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Contest</TableHead>
                                            <TableHead>Status</TableHead>
                                            <TableHead>Participants</TableHead>
                                            <TableHead>Date</TableHead>
                                            <TableHead className="text-right">Certificates</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {contests.map((contest) => (
                                            <TableRow key={contest.id}>
                                                <TableCell className="font-medium">{contest.title}</TableCell>
                                                <TableCell>
                                                    <Badge variant={contest.status === 'published' ? 'secondary' : contest.status === 'active' ? 'default' : 'outline'}>
                                                        {contest.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{contest.currentParticipants ?? contest._count?.participants ?? 0}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">
                                                    {contest.contestDate ? new Date(contest.contestDate).toLocaleDateString() : 'TBD'}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Link href={`/admin/contests/${contest.id}/certificates`}>
                                                        <Button size="sm" variant="ghost" className="gap-2">
                                                            Manage
                                                            <ArrowRight className="h-4 w-4" />
                                                        </Button>
                                                    </Link>

                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </WidgetErrorBoundary>
        </div>
    );
}
