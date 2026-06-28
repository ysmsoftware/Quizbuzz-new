'use client';

import { fmtDateTime } from '@/lib/formatDate';
import { Check, Clock, Calendar, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Contest, ContestPhase } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EditableField } from '@/components/ui/editable-field';

interface KeyDatesCardProps {
    contest: Contest;
    phase: ContestPhase;
    className?: string;
    onSave?: (field: string, value: any) => Promise<void>;
}

const formatToLocalDatetime = (dateStr: string | Date | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export function KeyDatesCard({ contest, phase, className, onSave }: KeyDatesCardProps) {
    const isCancelled = phase === 'CANCELLED';
    const isEndedOrLive = phase === 'LIVE' || phase === 'ENDED' || phase === 'RESULTS_PUBLISHED' || phase === 'REGISTRATION_CLOSED';

    const dates = [
        {
            label: 'Created',
            date: new Date(contest.createdAt),
            status: 'completed',
            isEditable: false,
        },
        {
            label: 'Published',
            date: contest.publishedAt ? new Date(contest.publishedAt) : null,
            status: contest.publishedAt ? 'completed' : 'pending',
            isEditable: false,
        },
        {
            label: 'Registration Ends',
            date: new Date(contest.registrationDeadline),
            status: phase === 'REGISTRATION_CLOSED' || phase === 'LIVE' || phase === 'ENDED' ? 'completed' : phase === 'PUBLISHED' ? 'active' : 'pending',
            isEditable: !isCancelled && !isEndedOrLive,
            fieldValue: formatToLocalDatetime(contest.registrationDeadline),
            onSave: async (val: string) => {
                if (!val) return;
                const utcDate = new Date(val).toISOString();
                await onSave?.('registrationDeadline', utcDate);
            }
        },
        {
            label: 'Contest Starts',
            date: new Date(contest.startTime),
            status: phase === 'LIVE' || phase === 'ENDED' ? 'completed' : phase === 'REGISTRATION_CLOSED' ? 'active' : 'pending',
            isEditable: !isCancelled && !isEndedOrLive,
            fieldValue: formatToLocalDatetime(contest.startTime),
            onSave: async (val: string) => {
                if (!val) return;
                const utcDate = new Date(val).toISOString();
                await onSave?.('startTime', utcDate);
            }
        },
        {
            label: 'Contest Ends',
            date: new Date(new Date(contest.startTime).getTime() + contest.durationMinutes * 60000),
            status: phase === 'ENDED' ? 'completed' : phase === 'LIVE' ? 'active' : 'pending',
            isEditable: !isCancelled && !isEndedOrLive,
            fieldValue: formatToLocalDatetime(new Date(new Date(contest.startTime).getTime() + contest.durationMinutes * 60000)),
            onSave: async (val: string) => {
                if (!val) return;
                const startMs = new Date(contest.startTime).getTime();
                const endMs = new Date(val).getTime();
                const diffMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
                await onSave?.('durationMinutes', diffMinutes);
            }
        },
        {
            label: 'Results Published',
            date: contest.resultsPublishedAt ? new Date(contest.resultsPublishedAt) : null,
            status: contest.resultsPublishedAt ? 'completed' : 'pending',
            isEditable: false,
        },
    ];

    return (
        <Card className={cn("overflow-hidden border-border/50", className)}>
            <CardHeader className="pb-3">
                <CardTitle className="text-lg font-bold">Key Milestones</CardTitle>
            </CardHeader>
            <CardContent className="relative px-6 py-4 space-y-9 before:absolute before:left-[2.75rem] before:top-6 before:h-[calc(100%-48px)] before:w-px before:bg-border/50">
                {dates.map((item, index) => {
                    const isActive = item.status === 'active';
                    const isCompleted = item.status === 'completed';
                    const isPending = item.status === 'pending';

                    return (
                        <div key={index} className="relative pl-14">
                            <div className={cn(
                                "absolute left-[0.625rem] top-1 flex h-5 w-5 items-center justify-center rounded-full border bg-background z-10 shadow-sm transition-all",
                                isCompleted && "border-green-500 bg-green-500 text-white",
                                isActive && "border-primary bg-primary text-white scale-110",
                                isPending && "border-muted-foreground/30 text-muted-foreground/30",
                                isCancelled && "border-destructive bg-destructive text-white"
                            )}>
                                {isCancelled ? <X className="h-3 w-3" /> :
                                    isCompleted ? <Check className="h-3 w-3" /> :
                                        isActive ? <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" /> :
                                            <div className="h-1 w-1 rounded-full bg-current" />}
                            </div>

                            <div className="flex flex-col gap-0.5 flex-1">
                                <span className={cn(
                                    "text-xs font-semibold uppercase tracking-wider",
                                    isActive ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {item.label}
                                </span>
                                {item.isEditable && onSave ? (
                                    <EditableField
                                        label={item.label}
                                        value={item.fieldValue || ''}
                                        displayValue={item.date ? fmtDateTime(item.date) : undefined}
                                        onSave={item.onSave!}
                                        type="datetime-local"
                                        disabled={isEndedOrLive}
                                        className="[&_label]:hidden [&_.group\/field]:py-0 [&_.group\/field]:px-0 [&_.group\/field]:min-h-[20px]"
                                    />
                                ) : (
                                    <span className="text-sm font-medium">
                                        {item.date ? fmtDateTime(item.date) : 'Pending'}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
