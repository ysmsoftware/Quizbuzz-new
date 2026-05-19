import Link from 'next/link';
import type { PublicContestSummary } from '@/lib/types/public-contest';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Calendar,
  Clock,
  Users,
  Trophy,
  AlertCircle,
  ArrowRight,
} from 'lucide-react';

interface ContestCardProps {
  contest: PublicContestSummary;
  variant?: 'default' | 'compact';
}

const statusLabels: Record<string, string> = {
  PUBLISHED: 'Open for Registration',
  REGISTRATION_CLOSED: 'Registration Closed',
  LIVE: 'Live Now',
  EVALUATION: 'Under Evaluation',
  RESULTS_OUT: 'Results Out',
  COMPLETED: 'Completed',
};

const statusColors: Record<string, string> = {
  PUBLISHED: 'bg-primary/10 text-primary',
  REGISTRATION_CLOSED: 'bg-warning/10 text-warning-foreground',
  LIVE: 'bg-success/10 text-success',
  EVALUATION: 'bg-secondary text-secondary-foreground',
  RESULTS_OUT: 'bg-accent/10 text-accent-foreground',
  COMPLETED: 'bg-secondary text-secondary-foreground',
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ContestCard({ contest, variant = 'default' }: ContestCardProps) {
  const participantCount = contest._count?.participants ?? 0;
  const questionCount = contest._count?.questions ?? 0;
  const maxParticipants = contest.maxParticipants;
  const spotsLeft = maxParticipants ? maxParticipants - participantCount : null;
  const spotsPercentage = maxParticipants ? (participantCount / maxParticipants) * 100 : 0;
  const isAlmostFull = maxParticipants ? spotsPercentage >= 80 : false;
  const fee = contest.paymentConfig?.amount ?? 0;
  const topic = contest.topics?.[0] ?? '';

  return (
    <Card className="group flex flex-col overflow-hidden transition-all hover:shadow-lg hover:border-primary/30">
      {/* Category Banner */}
      <div className="h-2 bg-primary" />

      <CardHeader className="space-y-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className={statusColors[contest.status] ?? ''}>
            {statusLabels[contest.status] ?? contest.status}
          </Badge>
        </div>

        <div>
          {topic && (
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {topic}
            </p>
          )}
          <h3 className="mt-1 text-lg font-semibold leading-tight text-balance group-hover:text-primary transition-colors">
            {contest.title}
          </h3>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-4">
        {contest.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {contest.description}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span>{formatDate(contest.startTime)}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4 flex-shrink-0" />
            <span>{contest.duration} mins</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4 flex-shrink-0" />
            <span>{participantCount.toLocaleString()} joined</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trophy className="h-4 w-4 flex-shrink-0" />
            <span>{questionCount} questions</span>
          </div>
        </div>

        {/* Capacity indicator — only show if maxParticipants is set */}
        {maxParticipants && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {(spotsLeft ?? 0).toLocaleString()} spots left
              </span>
              {isAlmostFull && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  Filling fast
                </span>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(spotsPercentage, 100)}%` }}
              />
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between border-t bg-secondary/30 pt-4">
        <div>
          <p className="text-xs text-muted-foreground">Registration Fee</p>
          <p className="text-lg font-semibold text-foreground">
            {fee === 0 ? 'Free' : formatCurrency(fee)}
          </p>
        </div>
        <Link href={`/contests/${contest.slug}`}>
          <Button size="sm" className="gap-1.5 group/btn">
            View Details
            <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
}
