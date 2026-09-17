'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
import { PrizeShowcase } from '@/components/contests/prize-showcase';
import { markdownComponents } from '@/components/contests/markdown-components';
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
  ShieldCheck,
  Shuffle,
  Hourglass,
  Coins,
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

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
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
  // Registration has closed but the contest hasn't finished — either the deadline
  // passed while still waiting to start ('registration_closed') or it's actively
  // running ('live'). Someone who already registered can still get into the quiz
  // from here via the join/check-in flow, instead of hitting a dead-end disabled
  // button. Once the contest reaches 'ended', joining no longer makes sense.
  const canJoinQuiz = phase === 'registration_closed' || phase === 'live';
  const fee = contest.paymentConfig?.amount ?? 0;
  const banner = publicPhaseBanner[phase];

  // Shared CTA target/label for the top hero button and the sticky bottom
  // bar (the sidebar card keeps its own distinct "Contest Ended" treatment
  // below, since it has room for an explicit label above the button too).
  // Once the contest has ended there's still one useful action left —
  // checking your result — so this is shown in all three CTA spots instead
  // of just going quiet. The results page does its own participant lookup
  // (email/phone/registration ref), so no participantId is needed here.
  // See contest-detail page audit.
  const showCta = isRegistrationOpen || canJoinQuiz || phase === 'ended';
  const ctaHref = isRegistrationOpen
    ? `/contests/${contest.slug}/register`
    : phase === 'ended'
      ? `/quiz/${contest.slug}/results`
      : `/quiz/${contest.slug}/join`;
  const ctaLabel = isRegistrationOpen
    ? 'Register Now'
    : phase === 'ended'
      ? 'Check Your Result'
      : (phase === 'live' ? 'Join Quiz Now' : 'Join Quiz');

  return (
    <div className={`bg-secondary/10${showCta ? ' pb-24' : ''}`}>
      {/* Compact hero — banner, status/topic badges, and title are one
          overlaid block instead of a full-height image followed by a
          separate gradient section, so the register CTA and quick stats sit
          close to the fold instead of being pushed down by the banner. See
          public-contest-page redesign. */}
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        {contest.bannerImage ? (
          <div className="relative overflow-hidden rounded-2xl border border-border/30 shadow-sm h-[180px] sm:h-[240px] lg:h-[280px] w-full">
            <img
              src={contest.bannerImage}
              alt={contest.title}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="absolute left-4 top-4 flex flex-wrap gap-2 sm:left-6 sm:top-5">
              <Badge variant="outline" className={`${banner.className} border-transparent bg-background/85 backdrop-blur-sm`}>
                {banner.label}
              </Badge>
            </div>
            <h1 className="absolute inset-x-4 bottom-4 text-2xl font-bold tracking-tight text-white text-balance drop-shadow-sm sm:inset-x-6 sm:bottom-5 sm:text-3xl lg:text-4xl">
              {contest.title}
            </h1>
          </div>
        ) : (
          <div className="flex flex-wrap items-start gap-2 pt-2">
            <Badge variant="outline" className={banner.className}>
              {banner.label}
            </Badge>
          </div>
        )}

        <div className="pt-4">
          {!contest.bannerImage && (
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">{contest.title}</h1>
          )}

          {contest.organization?.name && (
            <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
              <span className="grid size-5 place-items-center rounded-md bg-gradient-to-br from-accent to-accent/70 text-[10px] font-bold text-accent-foreground">
                {contest.organization.name.charAt(0)}
              </span>
              Hosted by {contest.organization.name}
            </p>
          )}

          {contest.description && (
            <p className="mt-2 text-base text-muted-foreground max-w-3xl">{contest.description}</p>
          )}

          {showCta && (
            <div className="mt-4">
              <Link href={ctaHref}>
                <Button size="lg" className="gap-2">
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          )}

          {/* Quick Stats */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex items-center gap-3 rounded-lg bg-card border p-3.5">
              <Calendar className="h-6 w-6 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Starts</p>
                <p className="text-sm font-semibold truncate">{formatDateTime(contest.startTime)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-card border p-3.5">
              <Clock className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="text-sm font-semibold">{contest.duration} minutes</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-card border p-3.5">
              <FileText className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Questions</p>
                <p className="text-sm font-semibold">{questionCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-card border p-3.5">
              <Users className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Registered</p>
                <p className="text-sm font-semibold">{participantCount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Prizes — moved above About/Rules so the payoff is visible before the
          fine print, and rendered without a bordered card wrapper around the
          podium (only the individual tier rows below it keep card styling).
          See public-contest-page redesign. */}
      {contest.prizes && contest.prizes.length > 0 && (
        <section className="pt-6 sm:pt-8">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-1 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-accent-foreground" />
              <h2 className="text-xl font-bold tracking-tight">Prizes & Recognition</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Merit ranked by score and speed — here&apos;s what the top performers take home.
            </p>
            <PrizeShowcase prizes={contest.prizes} />
          </div>
        </section>
      )}

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
                  {/* Topics moved here from the banner image overlay — the banner is
                      about the contest's look, not its metadata, and one topic pill
                      squeezed onto it never showed the full list anyway. */}
                  {contest.topics && contest.topics.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {contest.topics.map((t) => (
                        <Badge key={t} variant="secondary" className="text-xs">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {contest.details ? (
                    // Markdown structure (headings, bold, lists) already carries the
                    // hierarchy — a muted gray on top of that made body text hard to
                    // read, so this uses the same full-contrast foreground color as
                    // the rest of the page instead of a dimmed tone.
                    <div className="text-foreground text-sm">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {contest.details}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-muted-foreground whitespace-pre-line">
                      {contest.description || 'No details provided.'}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Contest Rules */}
              <Card>
                <CardHeader>
                  <CardTitle>Contest Rules & Format</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-3">
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

                  {/* Integrity & format — the booleans an organizer actually sets
                      (proctoring, shuffle, marking scheme) shown as scannable
                      chips instead of a checklist, plus a computed
                      average since marks/negative marks are set per question. */}
                  <div className="flex flex-wrap gap-2">
                    {contest.proctoringEnabled && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 px-3 py-1.5 text-xs font-medium">
                        <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                        Proctored
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 px-3 py-1.5 text-xs font-medium">
                      <Shuffle className="h-3.5 w-3.5 text-primary" />
                      Questions {contest.shuffleQuestions ? 'shuffled' : 'fixed order'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 px-3 py-1.5 text-xs font-medium">
                      <Shuffle className="h-3.5 w-3.5 text-primary" />
                      Options {contest.shuffleOptions ? 'shuffled' : 'fixed order'}
                    </span>
                    {contest.showResultsAfter != null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 px-3 py-1.5 text-xs font-medium">
                        <Hourglass className="h-3.5 w-3.5 text-primary" />
                        Results in {contest.showResultsAfter}h
                      </span>
                    )}
                    {contest.defaultQuestionMarks != null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 px-3 py-1.5 text-xs font-medium">
                        <Coins className="h-3.5 w-3.5 text-primary" />+{contest.defaultQuestionMarks} / -
                        {contest.defaultQuestionNegativeMark} marking
                      </span>
                    )}
                  </div>

                  {/* Server-defined rules */}
                  {contest.rules && contest.rules.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium">Additional Rules</h4>
                      <ul className="space-y-2">
                        {contest.rules.map((rule, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{rule}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>

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

                  {/* Timing — both dates show a time now; registration deadline
                      previously showed the date only, which read as if it
                      closed at midnight regardless of the actual cutoff. */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm gap-3">
                      <span className="text-muted-foreground">Registration Ends</span>
                      <span className="font-medium text-right">{formatDateTime(contest.registrationDeadline)}</span>
                    </div>
                    <div className="flex justify-between text-sm gap-3">
                      <span className="text-muted-foreground">Starts At</span>
                      <span className="font-medium text-right">{formatDateTime(contest.startTime)}</span>
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
                  ) : canJoinQuiz ? (
                    // Already-registered participants had no way back into the quiz from
                    // this page once registration closed — just a permanently-disabled
                    // button. Route them to the join/check-in flow instead, which itself
                    // gates on being a real registrant.
                    <Link href={`/quiz/${contest.slug}/join`} className="block">
                      <Button size="lg" className="w-full gap-2">
                        {phase === 'live' ? 'Join Quiz Now' : 'Join Quiz'}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    // Contest is over — there's no more registering/joining to
                    // do, but there IS still something actionable: checking
                    // your result. Made explicit ("Contest Ended" label above
                    // the button) so it reads as "this phase is over, here's
                    // what to do now" rather than a dead end. The results page
                    // does its own participant lookup (email/phone/reg ref),
                    // so no participantId is needed here. See contest-detail
                    // page audit.
                    <div className="space-y-2">
                      <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground">
                        <XCircle className="h-4 w-4" />
                        Contest Ended
                      </p>
                      <Link href={`/quiz/${contest.slug}/results`} className="block">
                        <Button size="lg" className="w-full gap-2">
                          Check Your Result
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
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

      {/* Sticky bottom action bar — always visible regardless of scroll
          position, so the way to register/join is never something the
          visitor has to find. Complements the top CTA above; this one stays
          on screen the whole time, with a subtle pulse to draw the eye on
          first load. See public-contest-page audit. */}
      {showCta && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold sm:text-base">{contest.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {isRegistrationOpen
                  ? (fee === 0 ? 'Free to register' : `Entry fee: ${formatCurrency(fee)}`)
                  : phase === 'ended'
                    ? 'Contest ended — check how you did'
                    : (phase === 'live' ? 'Contest is live now' : 'Already registered? Join here')}
              </p>
            </div>
            <Link href={ctaHref} className="shrink-0">
              <Button size="lg" className="animate-glow-pulse gap-2">
                {ctaLabel}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
