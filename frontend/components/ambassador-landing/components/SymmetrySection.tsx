'use client';

import React from 'react';
import { Building2, Megaphone, ArrowRight, ArrowLeftRight } from 'lucide-react';

interface SymmetrySectionProps {
  onOpenApply: () => void;
}

export const SymmetrySection: React.FC<SymmetrySectionProps> = ({ onOpenApply }) => {
  return (
    <section className="py-16 md:py-24 bg-[var(--card)] border-y border-[var(--border)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>TWO SIDES OF THE QUIZBUZZ ECOSYSTEM</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
            Built for organizers who host. Built for ambassadors who share.
          </h2>
          <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed">
            QuizBuzz connects organizations looking for authentic participation with students and community leaders who have the reach to deliver it.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {/* Card 1: For Organizers */}
          <div className="p-8 rounded-3xl border border-[var(--border)] bg-[var(--background)] flex flex-col justify-between hover:border-[var(--primary)]/40 transition-colors">
            <div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-6">
                <Building2 className="w-6 h-6" />
              </div>

              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1 block">
                For Contest Hosts &amp; Colleges
              </span>
              <h3 className="text-2xl font-extrabold text-[var(--foreground)] mb-3">
                Need more verified participants for your contest?
              </h3>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-6">
                Launch a campaign on QuizBuzz. Set your target participant numbers, define your reward rates, and let our network of 100+ student ambassadors distribute your competition across campuses.
              </p>

              <ul className="space-y-2.5 text-xs text-[var(--foreground)] font-medium mb-8">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Pay only for verified registrations, not impressions
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Real-time participant analytics &amp; fraud detection
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Full automated competition engine included
                </li>
              </ul>
            </div>

            <a
              href="https://ysmquizbuzz.com/organizers"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-xs font-bold bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--muted)] border border-[var(--border)] transition-colors"
            >
              <span>Host a Competition &amp; Launch Campaign</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Card 2: For Ambassadors */}
          <div className="p-8 rounded-3xl border-2 border-[var(--primary)] bg-[var(--background)] shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-[var(--primary)] text-white text-[10px] font-extrabold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
              You are here
            </div>

            <div>
              <div className="w-12 h-12 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center mb-6">
                <Megaphone className="w-6 h-6" />
              </div>

              <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)] mb-1 block">
                For Students &amp; Community Leaders
              </span>
              <h3 className="text-2xl font-extrabold text-[var(--foreground)] mb-3">
                Have an audience or campus network?
              </h3>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed mb-6">
                Discover high-value competitions, get your tracked referral links, and earn transparent monetary rewards and leadership badges for every student you introduce.
              </p>

              <ul className="space-y-2.5 text-xs text-[var(--foreground)] font-medium mb-8">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                  Free to join with instant campaign discovery
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                  Direct payouts with clear audit logs
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                  Compounding milestone bonuses &amp; rankings
                </li>
              </ul>
            </div>

            <button
              onClick={onOpenApply}
              className="inline-flex items-center justify-center gap-2 py-3 px-5 rounded-xl text-xs font-bold bg-[var(--primary)] text-white hover:opacity-95 shadow-md active:scale-98 transition-all"
            >
              <span>Join as an Ambassador</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};