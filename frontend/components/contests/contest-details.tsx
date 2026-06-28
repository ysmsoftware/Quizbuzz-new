'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { PublicContestDetail } from '@/lib/types/public-contest';
import { contestService } from '@/lib/services/contest-service';
import {
  getContestPhase,
  publicPhaseBanner,
  type PublicContestPhase,
} from '@/lib/contestStatus';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  Clock,
  Users,
  Trophy,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  FileText,
  Award,
  Timer,
} from 'lucide-react';

interface ContestDetailsProps {
  contest: PublicContestDetail;
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
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ContestDetails({ contest: initialContest }: ContestDetailsProps) {
  const [contest, setContest] = useState(initialContest);
  const [phase, setPhase] = useState<PublicContestPhase>(() =>
    getContestPhase(initialContest),
  );

  useEffect(() => {
    setContest(initialContest);
    setPhase(getContestPhase(initialContest));
  }, [initialContest]);

  // Recompute phase every 30s (banner transitions without reload)
  useEffect(() => {
    const phaseTimer = setInterval(() => setPhase(getContestPhase(contest)), 30_000);
    return () => clearInterval(phaseTimer);
  }, [contest]);

  // Refresh participant count every 60s
  useEffect(() => {
    const refresh = async () => {
      const res = await contestService.getContestBySlug(contest.slug);
      if (res.success && res.data) {
        setContest(res.data);
        setPhase(getContestPhase(res.data));
      }
    };
    const pollTimer = setInterval(refresh, 60_000);
    return () => clearInterval(pollTimer);
  }, [contest.slug]);

  const participantCount = contest._count?.participants ?? 0;
  const questionCount = contest._count?.questions ?? 0;
  const maxParticipants = contest.maxParticipants;
  const spotsLeft = maxParticipants ? maxParticipants - participantCount : null;
  const spotsPercentage = maxParticipants ? (participantCount / maxParticipants) * 100 : 0;
  const isRegistrationOpen = phase === 'registration_open';
  const fee = contest.paymentConfig?.amount ?? 0;
  const topic = contest.topics?.[0] ?? '';
  const banner = publicPhaseBanner[phase];

  return (
    <div className="bg-secondary/10">
      {/* Contest Banner Image */}
      {contest.bannerImage && (
        <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-border/30 shadow-sm aspect-[4/1] max-h-[250px] w-full">
            <img
              src={contest.bannerImage}
              alt={contest.title}
              className="object-cover w-full h-full"
            />
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/5 to-transparent border-b">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start gap-2 mb-4">
            <Badge variant="outline" className={banner.className}>
              {banner.label}
            </Badge>
            {topic && <Badge variant="outline">{topic}</Badge>}
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl text-balance">
            {contest.title}
          </h1>

          {contest.description && (
            <p className="mt-4 text-lg text-muted-foreground max-w-3xl">
              {contest.description}
            </p>
          )}

          {/* Quick Stats */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-3 rounded-lg bg-card border p-4">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="font-semibold">{formatDate(contest.startTime)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-card border p-4">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-semibold">{contest.duration} minutes</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-card border p-4">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Questions</p>
                <p className="font-semibold">{questionCount} questions</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-card border p-4">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Registered</p>
                <p className="font-semibold">{participantCount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column - Details */}
            <div className="lg:col-span-2 space-y-8">
              {/* About */}
              <Card>
                <CardHeader>
                  <CardTitle>About This Contest</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {contest.details || contest.description || 'No details provided.'}
                  </p>
                </CardContent>
              </Card>

              {/* Contest Rules */}
              <Card>
                <CardHeader>
                  <CardTitle>Contest Rules & Format</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Total Questions</p>
                        <p className="text-sm text-muted-foreground">{questionCount} questions</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Timer className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Time Limit</p>
                        <p className="text-sm text-muted-foreground">{contest.duration} minutes</p>
                      </div>
                    </div>
                    {contest.cutoffScore != null && (
                      <div className="flex items-start gap-3">
                        <Award className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium">Cutoff Score</p>
                          <p className="text-sm text-muted-foreground">{contest.cutoffScore}%</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium">Additional Rules</h4>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-sm">
                        {contest.shuffleQuestions ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>Questions {contest.shuffleQuestions ? 'will be' : 'will not be'} shuffled</span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        {contest.shuffleOptions ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>Options {contest.shuffleOptions ? 'will be' : 'will not be'} shuffled</span>
                      </li>
                    </ul>

                    {/* Server-defined rules */}
                    {contest.rules && contest.rules.length > 0 && (
                      <ul className="space-y-2 mt-3">
                        {contest.rules.map((rule, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Prizes */}
              {contest.prizes && contest.prizes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-accent" />
                      Prizes & Recognition
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {contest.prizes.map((prize, index) => (
                        <div
                          key={prize.id || index}
                          className={`flex items-center gap-4 p-4 rounded-lg border ${
                            index === 0
                              ? 'bg-accent/10 border-accent/30'
                              : index === 1
                                ? 'bg-secondary border-border'
                                : 'bg-card'
                          }`}
                        >
                          <div className={`flex h-12 w-12 items-center justify-center rounded-full font-bold ${
                            index === 0
                              ? 'bg-accent text-accent-foreground'
                              : index === 1
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-muted/50 text-muted-foreground'
                          }`}>
                            {prize.rankFrom === prize.rankTo
                              ? `#${prize.rankFrom}`
                              : `#${prize.rankFrom}-${prize.rankTo}`}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">
                              {prize.label || `Rank ${prize.rankFrom}${prize.rankTo !== prize.rankFrom ? `-${prize.rankTo}` : ''}`}
                            </p>
                            {prize.benefits && prize.benefits.length > 0 && (
                              <p className="text-sm text-muted-foreground">
                                {prize.benefits.join(', ')}
                              </p>
                            )}
                          </div>
                          {Number(prize.amount) > 0 && (
                            <p className="text-lg font-bold text-primary">
                              {formatCurrency(Number(prize.amount))}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Registration Card */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Register Now</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Fee */}
                  <div className="text-center py-4 bg-secondary/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Registration Fee</p>
                    <p className="text-4xl font-bold text-primary">
                      {fee === 0 ? 'Free' : formatCurrency(fee)}
                    </p>
                  </div>

                  {/* Timing */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Registration Ends</span>
                      <span className="font-medium">{formatDate(contest.registrationDeadline)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Starts At</span>
                      <span className="font-medium">{formatDateTime(contest.startTime)}</span>
                    </div>
                  </div>

                  {/* Capacity */}
                  {maxParticipants && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Available Spots</span>
                        <span className="font-medium">
                          {(spotsLeft ?? 0).toLocaleString()} / {maxParticipants.toLocaleString()}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.min(spotsPercentage, 100)}%` }}
                        />
                      </div>
                      {spotsPercentage >= 80 && (
                        <p className="flex items-center gap-1 text-xs text-destructive">
                          <AlertCircle className="h-3 w-3" />
                          Filling up fast!
                        </p>
                      )}
                    </div>
                  )}

                  {/* CTA */}
                  {isRegistrationOpen ? (
                    <Link href={`/contests/${contest.slug}/register`} className="block">
                      <Button size="lg" className="w-full gap-2">
                        Register Now
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button size="lg" className="w-full" disabled>
                      {phase === 'ended'
                        ? 'Contest Ended'
                        : phase === 'live'
                          ? 'Contest In Progress'
                          : 'Registration Closed'}
                    </Button>
                  )}

                  <p className="text-xs text-center text-muted-foreground">
                    By registering, you agree to our Terms of Service and Contest Rules
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
