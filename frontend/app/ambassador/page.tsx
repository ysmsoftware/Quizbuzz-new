'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Megaphone, UserPlus, ShieldCheck, Share2, Trophy, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { usePlatformAmbassadorTypes } from '@/lib/hooks/useAmbassadorTypes';

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

/**
 * Platform-level landing page — promotes becoming a QuizBuzz ambassador generally, not
 * any single organization's program. After signing up once, an ambassador can browse and
 * apply to campaigns from any organization (mirrors the public /contests "browse all"
 * page, which also isn't scoped to one org).
 */
export default function AmbassadorLandingPage() {
  const { types, isLoading: typesLoading } = usePlatformAmbassadorTypes();

  return (
    <div className="min-h-screen bg-background">
      <section className="px-4 pt-14 pb-10 sm:pt-20 sm:pb-14">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-2xl mx-auto text-center space-y-5"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1 text-xs font-semibold">
            <Megaphone className="h-3.5 w-3.5" />
            QuizBuzz Ambassador Program
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            Become a campus ambassador for QuizBuzz
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg">
            Sign up once, then promote contests from any organization running a campaign on QuizBuzz. Get your own
            referral link and sharing kit for each one, and earn rewards as your registrations grow.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href="/ambassador/signup">
                Sign Up
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="/ambassador/login">Already an ambassador? Log in</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      <section className="px-4 pb-10 sm:pb-14">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-6">
            How it works
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
              >
                <Card className="border-border/50 h-full">
                  <CardContent className="pt-6 space-y-2">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <p className="font-semibold text-foreground text-sm">
                      {i + 1}. {step.title}
                    </p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 sm:pb-20">
        <div className="max-w-2xl mx-auto">
          <Card className="border-border/50">
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-base font-semibold text-foreground">Who can apply</h2>
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
                    <Badge key={t.key} variant="secondary" className="font-normal text-sm py-1 px-3">
                      {t.label}
                    </Badge>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Pick the type that matches you when you sign up — each has its own quick verification step. Individual
                campaigns may only be open to certain types.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
