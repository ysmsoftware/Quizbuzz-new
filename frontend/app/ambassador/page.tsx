'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import {
  Megaphone,
  UserPlus,
  ShieldCheck,
  Share2,
  Trophy,
  ArrowRight,
  Wallet,
  Gift,
  Zap,
  Award,
  Layers,
  TrendingUp,
  Smartphone,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { usePlatformAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';
import { usePublicCampaigns } from '@/lib/hooks/useAmbassadorCampaigns';
import { Empty, EmptyDescription, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import type { AvailableCampaignItem } from '@/lib/types/ambassador';

const STEPS = [
  {
    icon: UserPlus,
    title: 'Sign up',
    description: 'Verify your email, then pick the ambassador type that fits you and upload ID proof — once, for the whole platform.',
  },
  {
    icon: Share2,
    title: 'Browse campaigns',
    description: 'See every active campaign across every organization on QuizBuzz, not just one — apply to as many as you like.',
  },
  {
    icon: ShieldCheck,
    title: 'Get approved',
    description: "Each campaign's organizer reviews your application and approves you to promote that specific contest.",
  },
  {
    icon: Trophy,
    title: 'Promote & earn',
    description: 'Share your referral link, track registrations on your dashboard, and climb the leaderboard for rewards.',
  },
];

const EARN_ITEMS = [
  {
    icon: Wallet,
    title: 'Per-registration incentive',
    description: 'An incentive for every person who registers through your link — the rate is defined by each campaign, not fixed platform-wide.',
  },
  {
    icon: Gift,
    title: 'Milestone gifts',
    description: 'Hit a registration tier — like Level 2 or Level 3 — and unlock a better rate plus a one-time bonus.',
    featured: true,
  },
  {
    icon: Zap,
    title: 'Speed bonus',
    description: 'Some campaigns reward fast starts — extra payout for registrations brought in during the opening window.',
  },
  {
    icon: Award,
    title: 'Leaderboard prizes',
    description: "Top referrers on a campaign's leaderboard can earn extra rewards set by that campaign's organizer.",
  },
];

const BENEFITS = [
  {
    icon: Layers,
    title: 'One profile, every campaign',
    description: 'Apply once per campaign, but your identity, proof, and history live in a single ambassador profile.',
  },
  {
    icon: TrendingUp,
    title: 'Live tracking, no guesswork',
    description: 'Watch registrations, tier progress, and payouts update in real time from your dashboard.',
  },
  {
    icon: Smartphone,
    title: 'Built for campus reach',
    description: 'Sharing kits, referral links, and QR codes made for handing out in classes, clubs, and group chats.',
  },
];

const ELIGIBILITY = [
  {
    title: 'Currently enrolled',
    description: 'Actively studying at a recognized college, university, or coaching institute in the current academic year.',
  },
  {
    title: 'Verifiable ID',
    description: 'Able to confirm enrollment with a student ID or other valid institutional proof.',
  },
  {
    title: 'Active on campus',
    description: 'Comfortable sharing information within clubs, classes, and student communities.',
  },
  {
    title: 'Committed for a full cycle',
    description: 'Available to stay active for at least one complete campaign, from launch through close.',
  },
];

const FAQS = [
  {
    q: 'Do I need to be enrolled at a college to apply?',
    a: "Most campaigns are aimed at students, but organizers can open theirs to any ambassador type — you'll see who's eligible before you apply to a specific campaign.",
  },
  {
    q: 'Can I be an ambassador for more than one organization?',
    a: 'Yes — your ambassador profile is platform-wide. Apply to as many active campaigns as you like, each with its own referral link and rewards.',
  },
  {
    q: 'When do I get paid?',
    a: "Payout timing and method are set by each campaign's organizer and shown on the campaign page — your dashboard always reflects the latest accrued amount.",
  },
  {
    q: 'What if my application gets rejected?',
    a: "You can re-apply to that campaign, or apply to any other open campaign — a rejection on one doesn't affect your ambassador profile or other applications.",
  },
];

const STATS = [
  { value: '500+', label: 'Active ambassadors' },
  { value: '40+', label: 'Colleges represented' },
  { value: '120+', label: 'Campaigns run' },
  { value: '10,000+', label: 'Rewards distributed' },
];

const AVATAR_STYLES = [
  'bg-primary',
  'bg-[oklch(0.62_0.13_170)]',
  'bg-[oklch(0.6_0.16_145)]',
  'bg-[oklch(0.58_0.15_190)]',
];

function rateRangeLabel(campaign: AvailableCampaignItem): string {
  const rates = (campaign.rewardConfig.milestoneTiers ?? []).map((t) => t.amountPerRegistration);
  if (rates.length === 0) return '—';
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  return min === max ? `₹${min}` : `₹${min}–${max}`;
}

function daysLeftLabel(campaign: AvailableCampaignItem): string {
  if (!campaign.endDate) return '—';
  const days = Math.max(0, Math.ceil((new Date(campaign.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  return `${days} day${days === 1 ? '' : 's'}`;
}

const GRAIN_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * Platform-level landing page — promotes becoming a QuizBuzz ambassador generally, not
 * any single organization's program. After signing up once, an ambassador can browse and
 * apply to campaigns from any organization (mirrors the public /contests "browse all"
 * page, which also isn't scoped to one org).
 */
export default function AmbassadorLandingPage() {
  const { types, isLoading: typesLoading } = usePlatformAmbassadorTypes();
  const { campaigns: liveCampaigns, isLoading: campaignsLoading } = usePublicCampaigns({ limit: 6 });

  return (
    <div className="min-h-screen bg-background">
      {/* ---------------- Ambassador top bar (dedicated — not the main app header) ---------------- */}
      <header className="border-b border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5">
          <Link href="/ambassador" className="flex items-center gap-2.5">
            <Image src="/quizBuzz-logo.png" alt="QuizBuzz" width={120} height={34} className="h-6 w-auto sm:h-7" />
            <span className="hidden text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
              Ambassador Program
            </span>
          </Link>
          <Link href="/ambassador/login" className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            Already an ambassador? Log in
          </Link>
        </div>
      </header>

      {/* ---------------- Hero ---------------- */}
      <section className="relative overflow-hidden px-4 pb-10 pt-14 sm:pb-14 sm:pt-20">
        <div
          className="pointer-events-none absolute inset-x-0 -top-24 h-[420px]"
          style={{
            backgroundImage:
              'radial-gradient(55% 50% at 28% 15%, color-mix(in oklch, var(--primary) 7%, transparent), transparent 70%)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-11 lg:grid-cols-[1.05fr_0.95fr]">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Megaphone className="h-3.5 w-3.5" />
              QuizBuzz Ambassador Program
            </div>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              Become a campus ambassador for QuizBuzz
            </h1>
            <p className="mt-4 max-w-[52ch] text-base text-muted-foreground sm:text-lg">
              Promote contests from any organization on QuizBuzz, using your own referral link — and earn rewards
              as your registrations grow.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/ambassador/signup">
                  Become an Ambassador
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>

            </div>
            <div className="mt-7 flex items-center gap-3">
              <div className="flex -space-x-2">
                {['P', 'R', 'A', 'S'].map((letter, i) => (
                  <div
                    key={letter}
                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-background text-[11px] font-bold text-white ${AVATAR_STYLES[i]}`}
                  >
                    {letter}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">100+ ambassadors</span> already sharing across{' '}
                <span className="font-semibold text-foreground">40+ colleges</span>
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="relative mx-auto w-full max-w-[390px] px-6 py-9"
          >
            <div
              className="pointer-events-none absolute -right-8 -top-8 h-64 w-64 rounded-full opacity-90 blur-sm"
              style={{
                backgroundImage:
                  'radial-gradient(circle at 30% 30%, color-mix(in oklch, var(--primary) 30%, transparent), transparent 60%), radial-gradient(circle at 72% 68%, color-mix(in oklch, var(--accent) 30%, transparent), transparent 60%)',
              }}
            />
            <div className="relative z-10 rounded-2xl border border-border bg-card p-6 shadow-xl">
              <p className="text-sm font-semibold text-foreground">Reward tiers</p>
              <div className="mt-3.5 flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                  <span className="w-14 shrink-0">Level 1</span>
                  <span className="ml-auto">Welcome badge</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary ring-4 ring-primary/20" />
                  <span className="w-14 shrink-0">Level 2</span>
                  <span className="ml-auto">Gift voucher</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-border" />
                  <span className="w-14 shrink-0">Level 3</span>
                  <span className="ml-auto">Mystery gift</span>
                </div>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">42 registrations this month</p>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[64%] rounded-full bg-gradient-to-r from-primary to-accent" />
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                <span>64% to Level 3</span>
                <span>8 more to go</span>
              </div>
            </div>

            <div className="absolute -bottom-4 right-0 z-20 flex items-center gap-2.5 rounded-xl border border-border bg-card px-4 py-3 shadow-lg">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/60 text-xs font-extrabold text-accent-foreground">
                #4
              </div>
              <div className="text-xs">
                <p>Campus rank</p>
                <p className="font-semibold text-foreground">Top 5 this week</p>
              </div>
            </div>
            <div className="absolute left-1 top-3 z-20 flex items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-2.5 shadow-lg">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-success/15 text-success">
                <TrendingUp className="h-3.5 w-3.5" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-foreground">+18 registrations</p>
                <p className="text-muted-foreground">this week</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ---------------- Stats (gradient hairline dividers, no full-band background) ---------------- */}
      <section className="relative py-12">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5"
          style={{
            backgroundImage:
              'linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 55%, transparent) 30%, color-mix(in oklch, var(--accent) 55%, transparent) 70%, transparent)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5"
          style={{
            backgroundImage:
              'linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 55%, transparent) 30%, color-mix(in oklch, var(--accent) 55%, transparent) 70%, transparent)',
          }}
        />
        <div className="mx-auto max-w-3xl px-4">
          <p className="mb-10 text-xl font-semibold sm:text-2xl">
            More than a referral program.{' '}
            <span className="font-normal text-muted-foreground">
              QuizBuzz Ambassadors is how campus communities discover, host, and win contests together.
            </span>
          </p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-4">
            {STATS.map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-extrabold tracking-tight text-primary">{stat.value}</div>
                <div className="mt-1 text-xs text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- Live campaigns — every organization's, cross-org like the rest of
          this page (mirrors how /contests isn't scoped to one org either) ---------------- */}
      <section className="px-4 py-14" id="live-campaigns">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Open now</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Campaigns accepting applications</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Every organization&apos;s active campaign, in one place — see what each one pays before you apply.
          </p>
        </div>
        <div className="mx-auto mt-10 max-w-5xl">
          {campaignsLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
              <Skeleton className="h-48 w-full rounded-xl" />
            </div>
          ) : liveCampaigns.length === 0 ? (
            <Empty>
              <EmptyMedia variant="icon">
                <Megaphone className="h-5 w-5" />
              </EmptyMedia>
              <EmptyTitle>No campaigns are live right now</EmptyTitle>
              <EmptyDescription>Check back soon, or sign up now so you&apos;re ready to apply the moment one opens.</EmptyDescription>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {liveCampaigns.map((campaign) => (
                <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="block">
                  <Card className="h-full border-border/60 transition hover:-translate-y-1 hover:shadow-lg">
                    <CardContent className="flex h-full flex-col pt-6">
                      <p className="text-xs font-semibold text-muted-foreground truncate">{campaign.organizationName}</p>
                      <p className="mt-0.5 text-base font-bold text-foreground truncate">{campaign.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground truncate">Promoting {campaign.contestTitle}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {campaign.ambassadorTypesAllowed.map((key) => (
                          <Badge key={key} variant="secondary" className="font-normal text-[11px]">
                            {types.find((t) => t.key === key)?.label ?? key}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-auto flex items-center justify-between gap-3 pt-4 mt-4 border-t border-border/60 text-xs">
                        <div>
                          <p className="font-bold text-foreground">{rateRangeLabel(campaign)}</p>
                          <p className="text-muted-foreground">per reg</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-foreground">{daysLeftLabel(campaign)}</p>
                          <p className="text-muted-foreground">left</p>
                        </div>
                      </div>
                      <p className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary">
                        View campaign
                        <ArrowRight className="h-3.5 w-3.5" />
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ---------------- How it works ---------------- */}
      <section className="px-4 py-14" id="how-it-works">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Getting started</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">How it works</h2>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card className="relative h-full overflow-hidden border-border/60 transition hover:-translate-y-1 hover:shadow-lg">
                <span className="pointer-events-none absolute -bottom-3 right-3 select-none text-6xl font-extrabold text-foreground/5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <CardContent className="relative space-y-2 pt-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {step.title}
                  </p>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ---------------- What you can earn ---------------- */}
      <section className="px-4 py-10">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Rewards</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">What you can earn</h2>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {EARN_ITEMS.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
            >
              <Card
                className={`h-full transition hover:-translate-y-1 hover:shadow-lg ${item.featured ? 'border-accent/50 bg-gradient-to-b from-accent/10 to-transparent' : 'border-border/60'
                  }`}
              >
                <CardContent className="space-y-2 pt-6">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${item.featured ? 'bg-accent/50 text-accent-foreground' : 'bg-primary/10 text-primary'
                      }`}
                  >
                    <item.icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
        <p className="mx-auto mt-6 max-w-3xl text-center text-xs text-muted-foreground">
          Exact rates and prizes are set per campaign and shown before you apply — the examples above describe the
          reward types, not fixed amounts.
        </p>
      </section>

      {/* ---------------- Why ambassadors stick around ---------------- */}
      <section className="px-4 py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Benefits</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Why ambassadors stick around</h2>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-3">
          {BENEFITS.map((benefit) => (
            <div key={benefit.title} className="flex gap-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <benefit.icon className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">{benefit.title}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Eligibility ---------------- */}
      <section className="px-4 py-14">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Eligibility</p>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Who can become an ambassador</h2>
        </div>
        <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-6 sm:grid-cols-2 sm:gap-9">
          {ELIGIBILITY.map((item) => (
            <div key={item.title} className="flex gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- Ambassador types + FAQ ---------------- */}
      <section className="px-4 py-14">
        <div className="mx-auto max-w-3xl">
          <Card className="mb-11 border-border/60">
            <CardContent className="space-y-4 pt-6">
              <h2 className="text-base font-semibold text-foreground">Ambassador types</h2>
              {typesLoading ? (
                <div className="flex gap-2">
                  <Skeleton className="h-7 w-28 rounded-full" />
                  <Skeleton className="h-7 w-24 rounded-full" />
                </div>
              ) : types.length === 0 ? (
                <p className="text-sm text-muted-foreground">Applications aren&apos;t open yet — check back soon.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {types.map((t) => (
                    <Badge key={t.key} variant="secondary" className="px-3 py-1 text-sm font-normal">
                      {t.label}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Pick the type that matches you when you sign up — each has its own quick verification step.
                Individual campaigns may only be open to certain types.
              </p>
            </CardContent>
          </Card>

          <div className="mb-7 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Support</p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">Frequently asked questions</h2>
          </div>
          <Accordion type="single" collapsible defaultValue="faq-0">
            {FAQS.map((faq, i) => (
              <AccordionItem key={faq.q} value={`faq-${i}`}>
                <AccordionTrigger className="text-base font-semibold">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ---------------- Closing CTA ---------------- */}
      <section className="px-4 pb-20 pt-4">
        <div className="mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-[22px] bg-primary px-8 py-13 text-center text-primary-foreground">
            <div
              className="pointer-events-none absolute inset-0 opacity-5 mix-blend-overlay"
              style={{ backgroundImage: GRAIN_URI, backgroundSize: '160px 160px' }}
            />
            <div
              className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full"
              style={{
                backgroundImage:
                  'radial-gradient(circle, color-mix(in oklch, var(--accent) 45%, transparent), transparent 70%)',
              }}
            />
            <div className="relative z-10">
              <h2 className="text-2xl font-extrabold sm:text-3xl">Ready to start earning as an ambassador?</h2>
              <p className="mx-auto mt-2.5 max-w-md text-primary-foreground/80">
                Takes about two minutes to sign up and verify your email.
              </p>
              <Button asChild size="lg" className="mt-6 bg-white text-foreground hover:bg-white/90">
                <Link href="/ambassador/signup">
                  Become an Ambassador
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
