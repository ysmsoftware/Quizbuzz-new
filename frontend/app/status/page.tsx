import { Metadata } from 'next';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent } from '@/components/ui/card';
import { BreadcrumbJsonLd } from '@/lib/seo/json-ld';
import { SITE_URL, SUPPORT_EMAIL } from '@/lib/seo/config';
import { CheckCircle2, Mail } from 'lucide-react';

export const metadata: Metadata = {
  title: 'System Status',
  description: 'Current operational status of QuizBuzz core services.',
  alternates: { canonical: '/status' },
  robots: { index: false, follow: true },
};

const SERVICES = [
  { name: 'Website & Web App', description: 'Marketing site, organizer dashboard, participant flows' },
  { name: 'API', description: 'Core application API' },
  { name: 'Real-time (contests, leaderboards)', description: 'Live quiz sessions, leaderboards, proctoring alerts' },
  { name: 'Payments', description: 'Contest registration payments via Razorpay' },
  { name: 'Proctoring', description: 'In-browser webcam/face-detection checks' },
  { name: 'Notifications', description: 'Email verification codes, registration & result emails' },
];

export default function StatusPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'System Status', url: `${SITE_URL}/status` },
        ]}
      />
      <Header />
      <main className="flex-1">
        <section className="border-b bg-secondary/20 py-12">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">System Status</h1>
            <p className="mt-2 text-muted-foreground">
              This is a manually maintained summary, not a live monitoring feed — if you&apos;re
              seeing an issue right now that isn&apos;t reflected here, please{' '}
              <a href="/contact" className="text-primary underline underline-offset-2">
                let us know
              </a>
              .
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <Card className="border-border/50 bg-card/50">
              <CardContent className="pt-6 divide-y divide-border">
                {SERVICES.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium text-sm">{service.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{service.description}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                      Operational
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="mt-8 flex items-start gap-3 rounded-lg border border-border/50 bg-secondary/20 p-4">
              <Mail className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-sm text-muted-foreground">
                Experiencing a problem during a live contest? Email{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline underline-offset-2">
                  {SUPPORT_EMAIL}
                </a>{' '}
                with your contest name and a screenshot if possible, and we&apos;ll look into it.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
