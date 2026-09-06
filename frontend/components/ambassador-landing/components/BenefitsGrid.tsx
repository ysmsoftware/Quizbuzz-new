'use client';

import React from 'react';
import { UserCheck, Compass, Activity, Share2, Layers, Award } from 'lucide-react';

export const BenefitsGrid: React.FC = () => {
  const benefits = [
    {
      num: '01',
      title: 'One Profile, Universal Access',
      desc: 'Verify your student or creator identity once. Apply across dozens of campaigns without resubmitting paperwork or re-registering each time.',
      icon: UserCheck,
    },
    {
      num: '02',
      title: 'Live Campaign Marketplace',
      desc: 'Discover active challenges from universities, corporate firms, and independent hackathons in one searchable catalog.',
      icon: Compass,
    },
    {
      num: '03',
      title: 'Transparent Real-Time Tracking',
      desc: 'Watch attribution in real time. Inspect visitor clicks, signup conversions, and audited payout accruals directly on your dashboard.',
      icon: Activity,
    },
    {
      num: '04',
      title: 'Ready-to-Deploy Sharing Tools',
      desc: 'Get campaign links, 300-DPI printable QR flyers, and copy-paste WhatsApp announcements generated automatically for every partnership.',
      icon: Share2,
    },
    {
      num: '05',
      title: 'Multi-Campaign Portfolio',
      desc: 'Don’t limit yourself to one competition. Represent multiple colleges and events at once, diversifying your reach and earning potential.',
      icon: Layers,
    },
    {
      num: '06',
      title: 'Compounding Reward Milestones',
      desc: 'Reach higher referral volumes to unlock permanent rate boosts, cash milestone grants, and certified leadership recommendations.',
      icon: Award,
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-[var(--card)] border-y border-[var(--border)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            <span>PLATFORM ADVANTAGES</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
            Everything you need to grow your reach.
          </h2>
          <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed">
            Built like professional affiliate software, tuned specifically for campus communities and student organizers.
          </p>
        </div>

        {/* 6 Grid items */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <div
                key={b.num}
                className="p-6 sm:p-7 rounded-2xl border border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]/40 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-mono font-bold text-[var(--muted-foreground)] opacity-60">
                      {b.num}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-[var(--foreground)] mb-2">
                    {b.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
                    {b.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};