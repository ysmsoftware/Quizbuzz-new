import { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent } from '@/components/ui/card';
import { BreadcrumbJsonLd } from '@/lib/seo/json-ld';
import { SITE_URL } from '@/lib/seo/config';
import {
  Trophy,
  Users,
  CreditCard,
  ShieldCheck,
  ArrowRight,
  MessageCircle,
  HelpCircle,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Help Center',
  description: 'Find guides and answers for taking a proctored contest, registering, payments, certificates, and organizing quizzes on QuizBuzz.',
  alternates: { canonical: '/help' },
};

const topics = [
  {
    title: 'For Participants',
    description: 'Registering, joining a contest, taking a quiz, and getting your certificate.',
    icon: Trophy,
    href: '/faq#for-participants',
  },
  {
    title: 'Proctoring & Technical',
    description: 'Webcam checks, fullscreen mode, system requirements, and connection issues.',
    icon: ShieldCheck,
    href: '/faq#proctoring',
  },
  {
    title: 'Payments & Refunds',
    description: 'How contest payments work, and what to do if something goes wrong.',
    icon: CreditCard,
    href: '/faq#payments-refunds',
  },
  {
    title: 'For Organizers',
    description: 'Creating contests, managing participants, and running the admin dashboard.',
    icon: Users,
    href: '/faq#for-organizers',
  },
];

export default function HelpCenterPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Help Center', url: `${SITE_URL}/help` },
        ]}
      />
      <Header />
      <main className="flex-1">
        <section className="border-b bg-secondary/20 py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Help Center</h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Guides and answers for taking part in contests or organizing your own on QuizBuzz.
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {topics.map((topic) => (
                <Link key={topic.title} href={topic.href}>
                  <Card className="h-full border-border/50 bg-card/50 transition-colors hover:border-primary/40">
                    <CardContent className="pt-6">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <topic.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h2 className="mt-4 text-lg font-semibold">{topic.title}</h2>
                      <p className="mt-2 text-sm text-muted-foreground">{topic.description}</p>
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                        View answers <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <HelpCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Browse the full FAQ</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Every common question, in one place, organized by topic.
                    </p>
                    <Link
                      href="/faq"
                      className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary"
                    >
                      Go to FAQ <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6 flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <MessageCircle className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Still need help?</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Can&apos;t find an answer? Reach out and we&apos;ll get back to you.
                    </p>
                    <Link
                      href="/contact"
                      className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary"
                    >
                      Contact support <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
