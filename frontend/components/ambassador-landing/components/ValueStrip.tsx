'use client';

import React from 'react';
import { Compass, Share2, Users2, Award, ArrowRight } from 'lucide-react';

export const ValueStrip: React.FC = () => {
  const steps = [
    {
      step: '01',
      tag: 'DISCOVER',
      title: 'Find active campaigns',
      desc: 'Browse open competitions from universities, institutes, and student communities on QuizBuzz.',
      icon: Compass,
    },
    {
      step: '02',
      tag: 'SHARE',
      title: 'Get campaign-specific tools',
      desc: 'Receive your unique referral link, high-res QR code, and pre-formatted messaging templates.',
      icon: Share2,
    },
    {
      step: '03',
      tag: 'GROW',
      title: 'Drive relevant registrations',
      desc: 'Connect your classmates, clubs, and audience with competitions they genuinely care about.',
      icon: Users2,
    },
    {
      step: '04',
      tag: 'EARN',
      title: 'Track progress & rewards',
      desc: 'Watch clicks, verified signups, tier unlocks, and transparent payouts directly on your dashboard.',
      icon: Award,
    },
  ];

  return (
    <section className="border-y border-[var(--border)] bg-[var(--card)] py-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
          {steps.map((item, index) => {
            const Icon = item.icon;
            return (
              <div
                key={item.tag}
                className="relative flex flex-col p-4 rounded-xl hover:bg-[var(--secondary)]/50 transition-colors group"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center font-bold text-xs">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                      {item.tag}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-[var(--muted-foreground)] opacity-60">
                    {item.step}
                  </span>
                </div>

                <h2 className="text-sm font-bold text-[var(--foreground)] mb-1.5 group-hover:text-[var(--primary)] transition-colors">
                  {item.title}
                </h2>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  {item.desc}
                </p>

                {/* Arrow connector on large screens (for steps 1-3) */}
                {index < 3 && (
                  <div className="hidden lg:block absolute -right-3 top-1/2 -translate-y-1/2 z-10 text-[var(--muted-foreground)]/40 pointer-events-none">
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