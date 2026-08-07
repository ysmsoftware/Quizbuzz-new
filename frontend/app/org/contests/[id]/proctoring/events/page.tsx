'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Activity,
  Eye,
  XCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { proctoringApi } from '@/lib/api/post-quiz.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PaginationBar } from '@/components/ui/pagination-bar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { cn } from '@/lib/utils';

const VIOLATION_TYPES = [
  'FACE_NOT_DETECTED',
  'MULTIPLE_FACES',
  'TAB_SWITCH',
  'FULLSCREEN_EXIT',
  'AUDIO_ANOMALY',
  'POOR_LIGHTING',
  'GAZE_AWAY',
  'WINDOW_BLUR',
  'SCREEN_RESIZE',
  'SNAPSHOT_START',
  'SNAPSHOT_MID_POINT',
  'SNAPSHOT_RANDOM',
  'SNAPSHOT_PRE_SUBMIT',
] as const;

const PAGE_SIZE = 25;

interface ProctoringEventRow {
  id: string;
  type: string;
  severity: number;
  occurredAt: string;
  snapshotUrl: string | null;
  participant: {
    id: string;
    contact: { firstName: string; lastName: string | null; email: string };
  };
}

const isValidDate = (date: unknown) => {
  const d = new Date(date as any);
  return d instanceof Date && !isNaN(d.getTime());
};

export default function ProctoringEventLogPage() {
  const { id: contestId } = useParams() as { id: string };
  const router = useRouter();

  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['proctoring-contest-events', contestId, { page, typeFilter }],
    queryFn: () =>
      proctoringApi.getContestEvents(contestId, {
        page,
        limit: PAGE_SIZE,
        type: typeFilter === 'all' ? undefined : typeFilter,
      }),
  });

  const raw = data?.data ?? {};
  const events = (raw.events ?? []) as ProctoringEventRow[];
  const total = raw.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const severityBadge = (severity: number) => {
    if (severity === 3) {
      return <Badge variant="outline" className="text-destructive border-destructive/30 bg-destructive/5 text-[10px] font-bold">HIGH</Badge>;
    }
    if (severity === 2) {
      return <Badge variant="outline" className="text-warning border-warning/30 bg-warning/5 text-[10px] font-bold">MEDIUM</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground border-muted-foreground/30 text-[10px] font-bold">LOW</Badge>;
  };

  return (
    <div className="p-4 md:p-8 space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => router.push(`/org/contests/${contestId}/proctoring`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Proctoring Control
          </Button>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-7 w-7 text-primary" />
            Full Event Log
          </h1>
          <p className="text-muted-foreground">
            Every proctoring event recorded for this contest, across all participants, newest first.
          </p>
        </div>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[220px] h-11 rounded-xl">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All event types</SelectItem>
            {VIOLATION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <WidgetErrorBoundary name="Proctoring Event Log">
        <Card className="bg-background/50 border-border/50 rounded-2xl overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-secondary/50">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-bold">Participant</TableHead>
                <TableHead className="font-bold">Event Type</TableHead>
                <TableHead className="font-bold">Severity</TableHead>
                <TableHead className="font-bold">Occurred At</TableHead>
                <TableHead className="font-bold text-right">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i} className="animate-pulse">
                    <TableCell colSpan={5} className="h-16 bg-secondary/10" />
                  </TableRow>
                ))
              ) : events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-40 text-center text-muted-foreground italic">
                    No proctoring events recorded{typeFilter !== 'all' ? ' for this type' : ''} yet.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((event) => {
                  const name = `${event.participant?.contact?.firstName ?? ''} ${event.participant?.contact?.lastName ?? ''}`.trim() || 'Unknown participant';
                  return (
                    <TableRow key={event.id} className="hover:bg-secondary/20 transition-colors">
                      <TableCell>
                        <div>
                          <p className="font-bold text-sm leading-none mb-1">{name}</p>
                          <p className="text-[10px] text-muted-foreground">{event.participant?.contact?.email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                          {event.type.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell>{severityBadge(event.severity)}</TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {isValidDate(event.occurredAt) ? format(new Date(event.occurredAt), 'PP · hh:mm:ss a') : '—'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {event.snapshotUrl ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="rounded-lg hover:bg-primary/10 hover:text-primary"
                            onClick={() => setPreviewPhotoUrl(event.snapshotUrl)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </WidgetErrorBoundary>

      {!isLoading && events.length > 0 && (
        <PaginationBar
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      )}

      {/* Snapshot Preview Dialog */}
      <Dialog open={!!previewPhotoUrl} onOpenChange={(open) => !open && setPreviewPhotoUrl(null)}>
        <DialogContent className="sm:max-w-2xl bg-slate-900 border-slate-800 text-white p-2">
          <DialogHeader className="hidden">
            <DialogTitle>Snapshot Preview</DialogTitle>
          </DialogHeader>
          {previewPhotoUrl && (
            <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-slate-950 flex flex-col items-center justify-center">
              <img src={previewPhotoUrl} alt="Violation Snapshot" className="max-w-full max-h-full object-contain" />
              <Button
                variant="outline"
                size="icon"
                className="absolute top-4 right-4 bg-slate-900/80 border-slate-700 text-white hover:bg-slate-800 hover:text-white"
                onClick={() => setPreviewPhotoUrl(null)}
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
