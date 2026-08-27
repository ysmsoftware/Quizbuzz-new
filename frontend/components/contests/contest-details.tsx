'use client';

import { useEffect, useState, type ReactNode } from 'react';
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

// The contest-create form labels this field "Rich Text Details / Markdown"
// and its placeholder is literal markdown (## headings, etc.), so it has to
// actually be rendered as markdown here — not dumped into a <p> as raw text.
// Styled to match the surrounding card typography rather than pulling in the
// Tailwind Typography plugin for one field.
const markdownComponents = {
  h1: ({ children }: { children?: ReactNode }) => (
    <h1 className="text-2xl font-bold text-foreground mt-6 mb-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }: { children?: ReactNode }) => (
    <h2 className="text-xl font-bold text-foreground mt-5 mb-2.5 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: { children?: ReactNode }) => (
    <h3 className="text-lg font-semibold text-foreground mt-4 mb-2 first:mt-0">{children}</h3>
  ),
  p: ({ children }: { children?: ReactNode }) => (
    <p className="leading-relaxed mb-3 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: ReactNode }) => (
    <ul className="list-disc pl-5 space-y-1 mb-3 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: { children?: ReactNode }) => (
    <ol className="list-decimal pl-5 space-y-1 mb-3 last:mb-0">{children}</ol>
  ),
  li: ({ children }: { children?: ReactNode }) => <li className="leading-relaxed">{children}</li>,
  a: ({ children, href }: { children?: ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary underline underline-offset-2 hover:no-underline"
    >
      {children}
    </a>
  ),
  strong: ({ children }: { children?: ReactNode }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  code: ({ children }: { children?: ReactNode }) => (
    <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-[0.85em] font-mono">{children}</code>
  ),
  blockquote: ({ children }: { children?: ReactNode }) => (
    <blockquote className="border-l-2 border-primary/30 pl-4 italic text-muted-foreground/90 my-3">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-border/50" />,
  table: ({ children }: { children?: ReactNode }) => (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }: { children?: ReactNode }) => (
    <th className="border border-border/50 px-2 py-1 text-left font-semibold bg-muted/50">{children}</th>
  ),
  td: ({ children }: { children?: ReactNode }) => (
    <td className="border border-border/50 px-2 py-1">{children}</td>
  ),
};

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
  // Registration has closed but the contest hasn't finished — either the deadline
  // passed while still waiting to start ('registration_closed') or it's actively
  // running ('live'). Someone who already registered can still get into the quiz
  // from here via the join/check-in flow, instead of hitting a dead-end disabled
  // button. Once the contest reaches 'ended', joining no longer makes sense.
  const canJoinQuiz = phase === 'registration_closed' || phase === 'live';
  const fee = contest.paymentConfig?.amount ?? 0;
  const topic = contest.topics?.[0] ?? '';
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

          {/* Top CTA — the full registration card lives in the sidebar further
              down the page, which can end up entirely below the fold (a
              banner image + this hero easily push it out of view on a
              laptop-sized viewport). Repeating a compact version of the same
              action here means a new visitor sees a real "Register Now"
              button immediately, instead of guessing that the top nav's
              "Install App" or "Browse Contests" is the way to register. See
              public-contest-page audit. */}
          {showCta && (
            <div className="mt-6">
              <Link href={ctaHref}>
                <Button size="lg" className="gap-2">
                  {ctaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
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
                  {contest.details ? (
                    <div className="text-muted-foreground text-sm">
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
