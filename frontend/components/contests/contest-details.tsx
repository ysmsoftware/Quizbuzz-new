"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { onImageError } from "@/lib/utils/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PublicContestDetail } from "@/lib/types/public-contest";
import { contestService } from "@/lib/services/contest-service";
import {
  getContestPhase,
  publicPhaseBanner,
  type PublicContestPhase,
} from "@/lib/contestStatus";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PrizeShowcase } from "@/components/contests/prize-showcase";
import { markdownComponents } from "@/components/contests/markdown-components";
import {
  Reveal,
  AnimatedCounter,
  AnimatedProgressBar,
  PulseDot,
  ExpandableRulesList,
} from "@/components/contests/contest-motion";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Clock,
  Users,
  Trophy,
  AlertCircle,
  ArrowRight,
  XCircle,
  FileText,
  Award,
  Timer,
  ShieldCheck,
  Shuffle,
  Hourglass,
  Coins,
} from "lucide-react";

// Shared surface treatment for the three main content cards — a softer
// radius and a wide, tinted "diffusion" shadow instead of the app-wide
// Card default, scoped to this page via className rather than changing the
// shared primitive (used in 70+ other places).
const CARD_SURFACE = "rounded-2xl shadow-[0_20px_40px_-24px_rgba(0,0,0,0.18)]";

interface ContestDetailsProps {
  contest: PublicContestDetail;
}

const statusLabels: Record<string, string> = {
  PUBLISHED: "Open for Registration",
  REGISTRATION_CLOSED: "Registration Closed",
  LIVE: "Live Now",
  EVALUATION: "Under Evaluation",
  RESULTS_OUT: "Results Out",
  COMPLETED: "Completed",
};

const statusColors: Record<string, string> = {
  PUBLISHED: "bg-primary/10 text-primary",
  REGISTRATION_CLOSED: "bg-warning/10 text-warning-foreground",
  LIVE: "bg-success/10 text-success",
  EVALUATION: "bg-secondary text-secondary-foreground",
  RESULTS_OUT: "bg-accent/10 text-accent-foreground dark:text-accent",
  COMPLETED: "bg-secondary text-secondary-foreground",
};

function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ContestDetails({
  contest: initialContest,
}: ContestDetailsProps) {
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
    const phaseTimer = setInterval(
      () => setPhase(getContestPhase(contest)),
      30_000,
    );
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
  const spotsPercentage = maxParticipants
    ? (participantCount / maxParticipants) * 100
    : 0;
  const isRegistrationOpen = phase === "registration_open";
  // Registration has closed but the contest hasn't finished — either the deadline
  // passed while still waiting to start ('registration_closed') or it's actively
  // running ('live'). Someone who already registered can still get into the quiz
  // from here via the join/check-in flow, instead of hitting a dead-end disabled
  // button. Once the contest reaches 'ended', joining no longer makes sense.
  const canJoinQuiz = phase === "registration_closed" || phase === "live";
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
  const showCta = isRegistrationOpen || canJoinQuiz || phase === "ended";
  const ctaHref = isRegistrationOpen
    ? `/contests/${contest.slug}/register`
    : phase === "ended"
      ? `/quiz/${contest.slug}/results`
      : `/quiz/${contest.slug}/join`;
  const ctaLabel = isRegistrationOpen
    ? "Register Now"
    : phase === "ended"
      ? "Check Your Result"
      : phase === "live"
        ? "Join Quiz Now"
        : "Join Quiz";

  return (
    <div className={`bg-secondary/10${showCta ? " pb-24" : ""}`}>
      {/* Hero. Banner (when present) carries the status badge + title as an
          overlay; below it the content splits asymmetrically at lg — story
          (org/description/CTA) on the left, the quick-facts panel as a
          distinct "data" column on the right — instead of a plain stacked
          grid-of-4 stat boxes. See public-contest-page redesign. */}
      <div className="mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
        {contest.bannerImage ? (
          <div className="relative overflow-hidden rounded-2xl border border-border/30 shadow-sm h-[180px] sm:h-[240px] lg:h-[320px] w-full">
            <Image
              src={contest.bannerImage}
              alt={contest.title}
              fill
              priority
              sizes="(max-width: 1280px) 100vw, 1280px"
              onError={onImageError}
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <Reveal
              mode="mount"
              className="absolute left-4 top-4 flex flex-wrap items-center gap-2 sm:left-6 sm:top-5"
            >
              <Badge
                variant="outline"
                className={`${banner.className} border-transparent bg-background/85 backdrop-blur-sm`}
              >
                {phase === "live" && <PulseDot className="mr-1.5" />}
                {banner.label}
              </Badge>
            </Reveal>
            <Reveal
              mode="mount"
              delay={0.08}
              className="absolute inset-x-4 bottom-4 sm:inset-x-6 sm:bottom-5"
            >
              <h1 className="text-3xl font-bold tracking-tighter leading-[0.95] text-white text-balance drop-shadow-sm sm:text-4xl lg:text-6xl">
                {contest.title}
              </h1>
            </Reveal>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            {phase === "live" && <PulseDot className="text-success" />}
            <Badge variant="outline" className={banner.className}>
              {banner.label}
            </Badge>
          </div>
        )}

        <div className="mt-6 lg:grid lg:grid-cols-[1.6fr_1fr] lg:items-start lg:gap-10">
          {/* Left — story */}
          <Reveal mode="mount" delay={0.05}>
            {!contest.bannerImage && (
              <h1 className="text-3xl font-bold tracking-tighter leading-[0.95] sm:text-4xl lg:text-6xl text-balance">
                {contest.title}
              </h1>
            )}

            {contest.organization?.name && (
              <p
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium text-muted-foreground",
                  !contest.bannerImage && "mt-3",
                )}
              >
                <span className="grid size-5 place-items-center rounded-md bg-gradient-to-br from-accent to-accent/70 text-[10px] font-bold text-accent-foreground">
                  {contest.organization.name.charAt(0)}
                </span>
                Hosted by {contest.organization.name}
              </p>
            )}

            {contest.description && (
              <p className="mt-2 text-base text-muted-foreground max-w-[60ch]">
                {contest.description}
              </p>
            )}

            {showCta && (
              <div className="mt-5">
                <Link href={ctaHref}>
                  <Button
                    size="lg"
                    className="gap-2 active:scale-[0.98] transition-transform"
                  >
                    {ctaLabel}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </Reveal>

          {/* Right — quick facts panel, a distinct glass surface instead of
              4 identical boxes */}
          <Reveal mode="mount" delay={0.12} className="mt-8 lg:mt-0">
            <div
              className={cn(
                "divide-y divide-border/60 border bg-card",
                CARD_SURFACE,
              )}
            >
              {[
                {
                  icon: Calendar,
                  label: "Starts",
                  value: formatDateTime(contest.startTime),
                },
                {
                  icon: Clock,
                  label: "Duration",
                  value: `${contest.duration} minutes`,
                },
                {
                  icon: FileText,
                  label: "Questions",
                  value: String(questionCount),
                },
                { icon: Users, label: "Registered", value: null },
              ].map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 px-4 py-3.5"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10">
                    <Icon className="h-4 w-4 text-primary" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="text-sm font-semibold">
                      {label === "Registered" ? (
                        <AnimatedCounter value={participantCount} />
                      ) : (
                        value
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </div>

      {/* Prizes — moved above About/Rules so the payoff is visible before the
          fine print, and rendered without a bordered card wrapper around the
          podium (only the individual tier rows below it keep card styling).
          See public-contest-page redesign. */}
      {contest.prizes && contest.prizes.length > 0 && (
        <section className="pt-10 sm:pt-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-primary">
                Top performers
              </p>
              <div className="mb-1 flex items-center gap-2">
                <Trophy className="h-6 w-6 text-primary" />
                <h2 className="text-2xl font-bold tracking-tighter sm:text-3xl">
                  Prizes & Recognition
                </h2>
              </div>
              <p className="mb-6 text-sm text-muted-foreground">
                Merit ranked by score and speed — here&apos;s what the top
                performers take home.
              </p>
            </Reveal>
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
              <Reveal>
                <Card className={CARD_SURFACE}>
                  <CardHeader>
                    <h2
                      data-slot="card-title"
                      className="leading-none font-semibold"
                    >
                      About This Contest
                    </h2>
                  </CardHeader>
                  <CardContent>
                    {/* Topics moved here from the banner image overlay — the banner is
                      about the contest's look, not its metadata, and one topic pill
                      squeezed onto it never showed the full list anyway. */}
                    {contest.topics && contest.topics.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {contest.topics.map((t) => (
                          <Badge
                            key={t}
                            variant="secondary"
                            className="text-xs"
                          >
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
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={markdownComponents}
                        >
                          {contest.details}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-muted-foreground whitespace-pre-line">
                        {contest.description || "No details provided."}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Reveal>

              {/* Contest Rules */}
              <Reveal delay={0.06}>
                <Card className={CARD_SURFACE}>
                  <CardHeader>
                    <h2
                      data-slot="card-title"
                      className="leading-none font-semibold"
                    >
                      Contest Rules & Format
                    </h2>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="flex items-start gap-3">
                        <FileText className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium">Total Questions</p>
                          <p className="text-sm text-muted-foreground">
                            {questionCount} questions
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Timer className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="font-medium">Time Limit</p>
                          <p className="text-sm text-muted-foreground">
                            {contest.duration} minutes
                          </p>
                        </div>
                      </div>
                      {contest.cutoffScore != null && (
                        <div className="flex items-start gap-3">
                          <Award className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            <p className="font-medium">Cutoff Score</p>
                            <p className="text-sm text-muted-foreground">
                              {contest.cutoffScore}%
                            </p>
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
                      {contest.shuffleQuestions === contest.shuffleOptions ? (
                        // Same setting for both — one chip instead of two identical-shaped
                        // ones, keeping the row within the ~4-chip scannable range.
                        <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 px-3 py-1.5 text-xs font-medium">
                          <Shuffle className="h-3.5 w-3.5 text-primary" />
                          Questions & options{" "}
                          {contest.shuffleQuestions
                            ? "shuffled"
                            : "fixed order"}
                        </span>
                      ) : (
                        <>
                          <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 px-3 py-1.5 text-xs font-medium">
                            <Shuffle className="h-3.5 w-3.5 text-primary" />
                            Questions{" "}
                            {contest.shuffleQuestions
                              ? "shuffled"
                              : "fixed order"}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 px-3 py-1.5 text-xs font-medium">
                            <Shuffle className="h-3.5 w-3.5 text-primary" />
                            Options{" "}
                            {contest.shuffleOptions
                              ? "shuffled"
                              : "fixed order"}
                          </span>
                        </>
                      )}
                      {contest.showResultsAfter != null && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 px-3 py-1.5 text-xs font-medium">
                          <Hourglass className="h-3.5 w-3.5 text-primary" />
                          Results in {contest.showResultsAfter}h
                        </span>
                      )}
                      {contest.defaultQuestionMarks != null && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/60 px-3 py-1.5 text-xs font-medium">
                          <Coins className="h-3.5 w-3.5 text-primary" />+
                          {contest.defaultQuestionMarks} / -
                          {contest.defaultQuestionNegativeMark} marking
                        </span>
                      )}
                    </div>

                    {/* Server-defined rules — capped at 5 with a spring-reveal
                      "Show all" toggle instead of one long wall of text. */}
                    {contest.rules && contest.rules.length > 0 && (
                      <div className="space-y-3">
                        <h3 className="font-medium">Additional Rules</h3>
                        <ExpandableRulesList rules={contest.rules} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </Reveal>
            </div>

            {/* Right Column - Registration Card. Shown first on mobile (order-first)
                so price/deadline/capacity aren't buried below the About/Rules cards;
                back to its natural sidebar position at the lg breakpoint. */}
            <Reveal
              delay={0.1}
              className="order-first lg:order-none lg:col-span-1"
            >
              <Card className={cn(CARD_SURFACE, "lg:sticky lg:top-24")}>
                <CardHeader>
                  <h2
                    data-slot="card-title"
                    className="leading-none font-semibold"
                  >
                    Register Now
                  </h2>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Fee */}
                  <div className="text-center py-4 bg-secondary/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      Registration Fee
                    </p>
                    <p className="text-4xl font-bold text-primary">
                      {fee === 0 ? "Free" : formatCurrency(fee)}
                    </p>
                  </div>

                  {/* Timing — both dates show a time now; registration deadline
                      previously showed the date only, which read as if it
                      closed at midnight regardless of the actual cutoff. */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm gap-3">
                      <span className="text-muted-foreground">
                        Registration Ends
                      </span>
                      <span className="font-medium text-right">
                        {formatDateTime(contest.registrationDeadline)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm gap-3">
                      <span className="text-muted-foreground">Starts At</span>
                      <span className="font-medium text-right">
                        {formatDateTime(contest.startTime)}
                      </span>
                    </div>
                  </div>

                  {/* Capacity */}
                  {maxParticipants && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          Available Spots
                        </span>
                        <span className="font-medium">
                          {(spotsLeft ?? 0).toLocaleString()} /{" "}
                          {maxParticipants.toLocaleString()}
                        </span>
                      </div>
                      <AnimatedProgressBar percentage={spotsPercentage} />
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
                    <Link
                      href={`/contests/${contest.slug}/register`}
                      className="block"
                    >
                      <Button
                        size="lg"
                        className="w-full gap-2 active:scale-[0.98] transition-transform"
                      >
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
                      <Button
                        size="lg"
                        className="w-full gap-2 active:scale-[0.98] transition-transform"
                      >
                        {phase === "live" ? "Join Quiz Now" : "Join Quiz"}
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
                      <Link
                        href={`/quiz/${contest.slug}/results`}
                        className="block"
                      >
                        <Button
                          size="lg"
                          className="w-full gap-2 active:scale-[0.98] transition-transform"
                        >
                          Check Your Result
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  )}

                  <p className="text-xs text-center text-muted-foreground">
                    By registering, you agree to our Terms of Service and
                    Contest Rules
                  </p>
                </CardContent>
              </Card>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Sticky bottom action bar — always visible regardless of scroll
          position, so the way to register/join is never something the
          visitor has to find. Complements the top CTA above; this one stays
          on screen the whole time, with a subtle pulse to draw the eye on
          first load. See public-contest-page audit. */}
      {showCta && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_-4px_16px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold sm:text-base">
                {contest.title}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {isRegistrationOpen
                  ? fee === 0
                    ? "Free to register"
                    : `Entry fee: ${formatCurrency(fee)}`
                  : phase === "ended"
                    ? "Contest ended — check how you did"
                    : phase === "live"
                      ? "Contest is live now"
                      : "Already registered? Join here"}
              </p>
            </div>
            <Link href={ctaHref} className="shrink-0">
              <Button
                size="lg"
                className="animate-glow-pulse gap-2 active:scale-[0.98] transition-transform"
              >
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
