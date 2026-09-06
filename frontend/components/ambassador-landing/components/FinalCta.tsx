'use client';

import React from 'react';
import { ArrowRight, Compass, Sparkles, CheckCircle2 } from 'lucide-react';

interface FinalCtaProps {
  onOpenApply: () => void;
  onExploreCampaigns: () => void;
}

export const FinalCta: React.FC<FinalCtaProps> = ({ onOpenApply, onExploreCampaigns }) => {
  return (
    <section className="py-20 md:py-28 bg-[var(--card)] border-t border-[var(--border)] relative overflow-hidden transition-colors">
      {/* Background ambient glow */}
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] pointer-events-none opacity-30 dark:opacity-15 blur-3xl -z-10"
        style={{
          background: 'radial-gradient(circle, var(--primary) 0%, var(--accent) 50%, transparent 80%)',
        }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-4">
          <Sparkles className="w-3.5 h-3.5" />
          <span>START CREATING IMPACT</span>
        </div>

        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)] leading-tight mb-5">
          Your audience is already out there. <br className="hidden sm:inline" />
          Now give them something worth discovering.
        </h2>

        <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed max-w-2xl mx-auto mb-9">
          Join the network of students, campus leads, and creators helping the best competitions on QuizBuzz reach the people who want to compete.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-8">
          <button
            onClick={onOpenApply}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl font-bold text-base bg-[var(--primary)] text-white hover:opacity-95 shadow-xl hover:shadow-2xl active:scale-98 transition-all"
          >
            <span>Become an Ambassador</span>
            <ArrowRight className="w-5 h-5" />
          </button>

          <button
            onClick={onExploreCampaigns}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-xl font-bold text-base bg-[var(--background)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--secondary)] active:scale-98 transition-all"
          >
            <Compass className="w-4 h-4 text-[var(--primary)]" />
            <span>Explore open campaigns</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-semibold text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            100+ active ambassadors
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            100% Free to join
          </span>
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Instant campaign discovery
          </span>
        </div>
      </div>
    </section>
  );
};