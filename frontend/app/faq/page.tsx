import { Metadata } from 'next';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FAQJsonLd, BreadcrumbJsonLd } from '@/lib/seo/json-ld';
import { SITE_URL, SUPPORT_EMAIL } from '@/lib/seo/config';

export const metadata: Metadata = {
  title: 'FAQ',
  description: 'Answers to common questions about registering for contests, proctoring, payments, certificates, and organizing quizzes on QuizBuzz.',
  alternates: { canonical: '/faq' },
};

interface FaqGroup {
  category: string;
  slug: string;
  items: { question: string; answer: string }[];
}

const FAQ_GROUPS: FaqGroup[] = [
  {
    category: 'Getting started',
    slug: 'getting-started',
    items: [
      {
        question: 'What is QuizBuzz?',
        answer:
          'QuizBuzz is a platform for creating, hosting, and taking online quizzes and contests. Organizations use it to run proctored assessments and competitions with real-time leaderboards; participants use it to browse, register for, and take part in contests.',
      },
      {
        question: 'Do I need an account to join a contest?',
        answer:
          'You register per-contest with your email (verified with a one-time code) and any other details the organizer requires. Organizer accounts (for creating and managing contests) are separate and are created via the "Create Account" flow.',
      },
    ],
  },
  {
    category: 'For participants',
    slug: 'for-participants',
    items: [
      {
        question: 'How do I join a contest?',
        answer:
          'Browse contests from the Browse Contests page, open one that interests you, and complete the registration form. If the contest requires payment, you\'ll be prompted to pay securely before your registration is confirmed.',
      },
      {
        question: 'What happens if my internet drops during a quiz?',
        answer:
          'QuizBuzz auto-saves your progress as you go. If your connection drops, reconnecting and returning to the quiz should restore your saved answers and remaining time, subject to the contest\'s time limit.',
      },
      {
        question: 'How do I get my certificate?',
        answer:
          'If the contest offers certificates, they\'re generated automatically once results are finalized, based on the criteria the organizer configured. You can access yours from the results page for that contest.',
      },
    ],
  },
  {
    category: 'Proctoring',
    slug: 'proctoring',
    items: [
      {
        question: 'Why does a contest need my webcam?',
        answer:
          'Some contests use webcam-based proctoring to help ensure fairness. Face detection runs in your browser to check things like presence and attention; any irregularities are logged and shown to that contest\'s organizer for review. Check the contest details before registering to see if proctoring applies.',
      },
      {
        question: 'What can get me flagged or disqualified during a proctored quiz?',
        answer:
          'Common triggers include no face being detected, multiple faces in frame, repeatedly looking away, or exiting fullscreen mode. Whether a flag leads to disqualification is up to that contest\'s organizer.',
      },
      {
        question: 'Do I need to do a system check before a proctored contest?',
        answer:
          'Yes — proctored contests include a system check step that verifies your camera, browser, and fullscreen support before the quiz begins, so it\'s worth completing that with time to spare.',
      },
    ],
  },
  {
    category: 'Payments & refunds',
    slug: 'payments-refunds',
    items: [
      {
        question: 'How are contest payments processed?',
        answer:
          'Paid contest entries are processed securely through Razorpay. QuizBuzz doesn\'t store your full card or bank details.',
      },
      {
        question: 'My payment was debited but my registration wasn\'t confirmed. What do I do?',
        answer: `This can happen if verification times out — in most cases the payment is automatically refunded or confirmed shortly after. If it's not resolved, contact ${SUPPORT_EMAIL} with your registration details.`,
      },
      {
        question: 'Can I get a refund if I can no longer attend?',
        answer:
          'Refund policies are set by each contest\'s organizer, not by QuizBuzz directly. Check the specific contest\'s details for its refund terms before registering.',
      },
    ],
  },
  {
    category: 'For organizers',
    slug: 'for-organizers',
    items: [
      {
        question: 'What can I do from the organizer dashboard?',
        answer:
          'Create and manage quizzes/contests with a drag-and-drop question builder, manage participant contacts and communication, monitor contests live (including proctoring alerts), review analytics and results, and generate certificates.',
      },
      {
        question: 'Can I run contests for multiple teams or clients from one account?',
        answer:
          'Yes — QuizBuzz is multi-tenant, so a single organization account can manage multiple contests independently.',
      },
    ],
  },
];

export default function FaqPage() {
  const flatFaqItems = FAQ_GROUPS.flatMap((group) => group.items);

  return (
    <div className="flex min-h-screen flex-col">
      <FAQJsonLd items={flatFaqItems} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: SITE_URL },
          { name: 'FAQ', url: `${SITE_URL}/faq` },
        ]}
      />
      <Header />
      <main className="flex-1">
        <section className="border-b bg-secondary/20 py-12">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Frequently Asked Questions
            </h1>
            <p className="mt-2 text-muted-foreground">
              Can&apos;t find what you&apos;re looking for? Visit our{' '}
              <a href="/help" className="text-primary underline underline-offset-2">
                Help Center
              </a>{' '}
              or{' '}
              <a href="/contact" className="text-primary underline underline-offset-2">
                contact us
              </a>
              .
            </p>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 space-y-10">
            {FAQ_GROUPS.map((group) => (
              <div key={group.category} id={group.slug} className="scroll-mt-24">
                <h2 className="text-lg font-semibold tracking-tight mb-2">{group.category}</h2>
                <Accordion type="single" collapsible className="w-full">
                  {group.items.map((item) => (
                    <AccordionItem key={item.question} value={item.question}>
                      <AccordionTrigger>{item.question}</AccordionTrigger>
                      <AccordionContent className="text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
