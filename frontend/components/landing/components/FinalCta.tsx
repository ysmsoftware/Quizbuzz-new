'use client';

import { ArrowRight, Search, Sparkles } from 'lucide-react';

interface FinalCtaProps {
  onCreateContest: () => void;
  onExploreContests: () => void;
}

export function FinalCta({ onCreateContest, onExploreContests }: FinalCtaProps) {
  const threadSteps = ['REGISTER', 'VERIFY', 'COMPETE', 'MONITOR', 'RANK', 'CERTIFY'];

  return (
    <section className="py-24 bg-gradient-to-b from-[var(--background)] to-[var(--secondary)]/50 relative overflow-hidden border-b border-[var(--border)]">
      {/* Glow background accent */}
      <div className="absolute inset-0 pointer-events-none -z-10 flex items-center justify-center">
        <div className="w-[600px] h-[300px] bg-[var(--primary)]/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Animated Contest Flow Motif */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-8 overflow-x-auto py-2 scrollbar-none">
          {threadSteps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-2 sm:gap-3 shrink-0">
              <span className="text-[10px] sm:text-xs font-mono font-bold tracking-widest text-[var(--muted-foreground)] px-2 py-1 rounded bg-[var(--card)] border border-[var(--border)]">
                {step}
              </span>
              {idx < threadSteps.length - 1 && (
                <span className="text-[var(--primary)] font-bold text-xs">→</span>
              )}
            </div>
          ))}
        </div>

        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
          Your next contest starts here.
        </h2>

        <p className="mt-5 text-base sm:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto leading-relaxed">
          Build the competition, bring your participants, and go live —<br />
          QuizBuzz handles the infrastructure behind it.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={onCreateContest}
            className="px-7 py-3.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2 cursor-pointer"
          >
            Create a contest
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onExploreContests}
            className="px-6 py-3.5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-semibold text-sm hover:bg-[var(--secondary)] transition-all cursor-pointer flex items-center gap-2"
          >
            <Search className="w-4 h-4 text-[var(--muted-foreground)]" />
            Explore open contests
          </button>
        </div>

        <p className="mt-6 text-xs text-[var(--muted-foreground)]">
          Free to start for faculty, student organizations & hackathon chairs.
        </p>
      </div>
    </section>
  );
}