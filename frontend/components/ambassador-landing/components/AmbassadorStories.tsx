'use client';

import React from 'react';
import { Quote, Trophy, TrendingUp, CheckCircle2 } from 'lucide-react';
import { TESTIMONIAL_STORIES } from '../data/mockData';

export const AmbassadorStories: React.FC = () => {
  return (
    <section className="py-16 md:py-24 bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            <span>VOICES OF THE NETWORK</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
            Built by people who love bringing communities together.
          </h2>
          <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed">
            See how student leaders, faculty coordinators, and community ambassadors are building reputation and earnings through QuizBuzz.
          </p>
        </div>

        {/* 3 Story Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {TESTIMONIAL_STORIES.map((story) => (
            <div
              key={story.name}
              className="p-7 rounded-2xl border border-[var(--border)] bg-[var(--card)] flex flex-col justify-between hover:border-[var(--primary)]/40 hover:shadow-xl transition-all"
            >
              <div>
                {/* Metrics Header */}
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
                  <div>
                    <div className="text-xl font-black text-[var(--foreground)] tracking-tight">
                      {story.stats.registrations} regs
                    </div>
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      ₹{story.stats.earned.toLocaleString()} earned
                    </div>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--secondary)] text-[var(--secondary-foreground)] font-semibold">
                    {story.stats.campaigns} campaigns
                  </span>
                </div>

                {/* Quote */}
                <div className="relative mb-6">
                  <Quote className="w-8 h-8 text-[var(--primary)]/20 absolute -top-3 -left-2 -z-0" />
                  <p className="relative z-10 text-xs sm:text-sm text-[var(--foreground)] leading-relaxed italic">
                    "{story.quote}"
                  </p>
                </div>
              </div>

              {/* Author Footer */}
              <div className="flex items-center gap-3 pt-4 border-t border-[var(--border)]">
                <div className="w-10 h-10 rounded-full bg-[var(--primary)] text-white font-bold text-sm flex items-center justify-center shrink-0">
                  {story.avatarSeed}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-[var(--foreground)] truncate flex items-center gap-1.5">
                    {story.name}
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] truncate">
                    {story.role} • {story.collegeOrCommunity}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};