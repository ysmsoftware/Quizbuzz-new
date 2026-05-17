'use client';

import { format } from 'date-fns';
import { Check, Clock, Calendar, X, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Contest, ContestPhase } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';


interface KeyDatesCardProps {
    contest: Contest;
    phase: ContestPhase;
    className?: string;
}

export function KeyDatesCard({ contest, phase, className }: KeyDatesCardProps) {
    const isCancelled = phase === 'CANCELLED';

    const dates = [
        {
            label: 'Created',
            date: new Date(contest.createdAt),
            status: 'completed',
        },
        {
            label: 'Published',
            date: contest.publishedAt ? new Date(contest.publishedAt) : null,
            status: contest.publishedAt ? 'completed' : 'pending',
        },
        {
            label: 'Registration Ends',
            date: new Date(contest.registrationDeadline),
            status: phase === 'REGISTRATION_CLOSED' || phase === 'LIVE' || phase === 'ENDED' ? 'completed' : phase === 'PUBLISHED' ? 'active' : 'pending',
        },
        {
            label: 'Contest Starts',
            date: new Date(contest.startTime),
            status: phase === 'LIVE' || phase === 'ENDED' ? 'completed' : phase === 'REGISTRATION_CLOSED' ? 'active' : 'pending',
        },
        {
            label: 'Contest Ends',
            date: new Date(new Date(contest.startTime).getTime() + contest.durationMinutes * 60000),
            status: phase === 'ENDED' ? 'completed' : phase === 'LIVE' ? 'active' : 'pending',
        },
        {
            label: 'Results Published',
            date: null, // Placeholder
            status: 'pending',
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

                            <div className="flex flex-col gap-0.5">
                                <span className={cn(
                                    "text-xs font-semibold uppercase tracking-wider",
                                    isActive ? "text-primary" : "text-muted-foreground"
                                )}>
                                    {item.label}
                                </span>
                                {item.date ? (
                                    <span className="text-sm font-medium">
                                        {format(item.date, 'eee, d MMM yyyy')}
                                        <span className="text-muted-foreground font-normal ml-1">
                                            at {format(item.date, 'hh:mm a')}
                                        </span>
                                    </span>
                                ) : (
                                    <span className="text-sm font-medium text-muted-foreground/50">
                                        Pending
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
