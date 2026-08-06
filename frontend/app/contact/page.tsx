import { Metadata } from 'next';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { Card, CardContent } from '@/components/ui/card';
import { ContactForm } from '@/components/features/contact/contact-form';
import { BreadcrumbJsonLd } from '@/lib/seo/json-ld';
import { SITE_URL, SUPPORT_EMAIL, SUPPORT_WHATSAPP_DISPLAY, SUPPORT_WHATSAPP_URL } from '@/lib/seo/config';
import { WhatsAppIcon } from '@/components/icons/whatsapp-icon';
import { Mail, HelpCircle, Users } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with the QuizBuzz team for support, organizer questions, or partnership inquiries.',
  alternates: { canonical: '/contact' },
};

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'Contact Us', url: `${SITE_URL}/contact` },
        ]}
      />
      <Header />
      <main className="flex-1">
        <section className="border-b bg-secondary/20 py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Contact Us</h1>
            <p className="mt-2 text-muted-foreground max-w-2xl">
              Questions about a contest, your account, or organizing on QuizBuzz? Send us a
              message.
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid gap-10 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6">
                  <ContactForm />
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6 flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Email support</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary underline underline-offset-2">
                        {SUPPORT_EMAIL}
                      </a>
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6 flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <WhatsAppIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold">WhatsApp</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      <a
                        href={SUPPORT_WHATSAPP_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline underline-offset-2"
                      >
                        {SUPPORT_WHATSAPP_DISPLAY}
                      </a>
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6 flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <HelpCircle className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Have a quick question?</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Check the{' '}
                      <a href="/faq" className="text-primary underline underline-offset-2">
                        FAQ
                      </a>{' '}
                      — most common questions are answered there.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50 bg-card/50">
                <CardContent className="pt-6 flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-semibold">Want to organize on QuizBuzz?</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Mention it in your message, or{' '}
                      <a href="/register" className="text-primary underline underline-offset-2">
                        create an organizer account
                      </a>{' '}
                      to get started directly.
                    </p>
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
