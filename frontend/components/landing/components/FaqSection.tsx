'use client';

import { useState } from 'react';
import { HelpCircle, ChevronDown } from 'lucide-react';

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: 'What is QuizBuzz?',
      a: 'QuizBuzz is the complete contest infrastructure platform for creating and running online competitions — covering the entire workflow from registration and fee payments through competition, live proctoring, rankings, analytics, and verified certification.',
    },
    {
      q: 'Who can use QuizBuzz?',
      a: 'Schools, autonomous colleges, universities, student tech chapters, corporate HR assessment teams, hackathon coordinators, and independent quiz organizers who need serious competition infrastructure.',
    },
    {
      q: 'Can I create my own contest?',
      a: 'Yes. Organizers can configure contests through the organizer dashboard — setting capacity, timing, question banks, proctoring strictness, and certificate templates in minutes.',
    },
    {
      q: 'Does QuizBuzz support proctoring?',
      a: 'Yes. QuizBuzz includes non-intrusive, browser-based monitoring: kiosk fullscreen lock, webcam face detection, tab-switch logging, and audio calibration. All signals are queued for faculty review — candidates are never auto-disqualified by algorithm.',
    },
    {
      q: 'Can I run paid contests?',
      a: 'Yes. Organizers can set ticketed entry or sponsored tracks with integrated UPI, credit card, and Razorpay/Stripe checkout. Payment reconciliation with participant registration is 100% automated.',
    },
    {
      q: 'Are certificates generated automatically?',
      a: 'Yes. The instant a round concludes, verified certificates are issued with unique tamper-proof cryptographic hashes that employers and university authorities can verify without logging in.',
    },
    {
      q: 'Can I brand my contest?',
      a: 'Yes. White-labeling allows you to host on your own custom domain (e.g., contest.university.edu), apply your institution brand colors, and add official faculty seals to all certificates.',
    },
    {
      q: 'How does participant registration work?',
      a: 'Participants register via a dedicated contest page, select their institution and cohort department, complete a 30-second pre-flight system check, and enter the live room at the scheduled start time.',
    },
  ];

  return (
    <section className="py-20 bg-[var(--background)] border-b border-[var(--border)] relative" id="faq">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-4">
            <HelpCircle className="w-3.5 h-3.5" />
            Frequently Asked Questions
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
            Before you launch your contest.
          </h2>

          <p className="mt-4 text-base text-[var(--muted-foreground)] max-w-xl mx-auto">
            Everything you need to know about the platform, proctoring standards, and institutional scale.
          </p>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-[var(--foreground)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[var(--muted-foreground)] shrink-0 transition-transform duration-200 ${
                      isOpen ? 'rotate-180 text-[var(--primary)]' : ''
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed border-t border-[var(--border)]/60 bg-[var(--secondary)]/20 animate-in fade-in duration-150">
                    {faq.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}