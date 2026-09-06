'use client';

import React from 'react';
import { UserPlus, Compass, FileCheck, Share2, Banknote, ArrowRight } from 'lucide-react';

export const HowItWorksTimeline: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'JOIN',
      subtitle: 'Create your unified profile',
      desc: 'Sign up once with your email, select your ambassador track, and verify your student or community identity.',
      icon: UserPlus,
    },
    {
      step: '02',
      title: 'DISCOVER',
      subtitle: 'Browse campaign marketplace',
      desc: 'Explore open campaigns across engineering, aptitude, and commerce. Review reward rates and eligibility.',
      icon: Compass,
    },
    {
      step: '03',
      title: 'APPLY',
      subtitle: '1-click campaign partnership',
      desc: 'Request authorization from the organizer. Most student applicants are verified and approved within 24 hours.',
      icon: FileCheck,
    },
    {
      step: '04',
      title: 'SHARE',
      subtitle: 'Deploy your unique referral tools',
      desc: 'Receive your campaign link, dynamic QR codes, and pre-written WhatsApp and social blurbs.',
      icon: Share2,
    },
    {
      step: '05',
      title: 'EARN',
      subtitle: 'Watch registrations turn to rewards',
      desc: 'Track conversions on your live dashboard and receive automated direct payouts as campaigns close.',
      icon: Banknote,
    },
  ];

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-[var(--card)] border-y border-[var(--border)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            <span>THE AMBASSADOR JOURNEY</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
            From application to your first reward.
          </h2>
          <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed">
            No convoluted approval pipelines or hidden clauses. A clean 5-step path designed for seamless campus and digital reach.
          </p>
        </div>

        {/* 5-Step Horizontal Journey Grid */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative">
          {steps.map((s, idx) => {
            const Icon = s.icon;
            return (
              <div
                key={s.step}
                className="relative p-6 rounded-2xl border border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]/50 hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center group-hover:bg-[var(--primary)] group-hover:text-white transition-colors">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-sm font-mono font-black text-[var(--muted-foreground)] opacity-60">
                      {s.step}
                    </span>
                  </div>

                  <div className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-1">
                    {s.title}
                  </div>
                  <h3 className="text-base font-bold text-[var(--foreground)] mb-2">
                    {s.subtitle}
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                    {s.desc}
                  </p>
                </div>

                {/* Connector line for desktop between steps */}
                {idx < 4 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-[var(--muted-foreground)]/30 pointer-events-none">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};