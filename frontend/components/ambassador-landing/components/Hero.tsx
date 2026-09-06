'use client';

import React, { useState, useEffect } from 'react';
import { ArrowRight, Copy, Check, TrendingUp, Award, Zap, Users, Sparkles, ExternalLink } from 'lucide-react';

interface HeroProps {
  onOpenApply: () => void;
  onExploreCampaigns: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenApply, onExploreCampaigns }) => {
  const [registrations, setRegistrations] = useState<number>(42);
  const [earnings, setEarnings] = useState<number>(1050);
  const [copied, setCopied] = useState<boolean>(false);
  const [justBumped, setJustBumped] = useState<boolean>(false);

  // Auto-increment every 7 seconds to simulate active network traffic
  useEffect(() => {
    const timer = setInterval(() => {
      setRegistrations((prev) => {
        const next = prev < 50 ? prev + 1 : 42;
        setEarnings(next * 25);
        setJustBumped(true);
        setTimeout(() => setJustBumped(false), 1200);
        return next;
      });
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = () => {
    navigator.clipboard?.writeText('https://ysmquizbuzz.com/contest/national-aptitude-sprint-2026?ref=ABC12D');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualSimulate = () => {
    setRegistrations((prev) => prev + 1);
    setEarnings((prev) => prev + 25);
    setJustBumped(true);
    setTimeout(() => setJustBumped(false), 1200);
  };

  const progressPercent = Math.min(Math.round((registrations / 50) * 100), 100);

  return (
    <section className="relative overflow-hidden pt-12 pb-16 md:pt-20 md:pb-24 bg-[var(--background)]">
      {/* Background soft ambient radial glow */}
      <div
        className="absolute top-0 left-1/4 -translate-x-1/2 w-[600px] h-[450px] pointer-events-none opacity-40 dark:opacity-20 blur-3xl -z-10"
        style={{
          background: 'radial-gradient(circle, color-mix(in oklch, var(--primary) 25%, transparent) 0%, color-mix(in oklch, var(--accent) 15%, transparent) 50%, transparent 70%)',
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Hero Copy & Value Pitch */}
          <div className="lg:col-span-7 flex flex-col items-start">
            {/* Pill Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-[color-mix(in_oklch,var(--primary)_10%,var(--background))] text-[var(--primary)] border border-[color-mix(in_oklch,var(--primary)_25%,transparent)] mb-6">
              <span className="w-2 h-2 rounded-full bg-[var(--primary)] animate-pulse" />
              <span>QUIZBUZZ AMBASSADOR PROGRAM</span>
            </div>

            {/* Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--foreground)] leading-[1.08] mb-6">
              Turn your reach into <span className="text-[var(--primary)]">impact</span> — and rewards.
            </h1>

            {/* Supporting copy */}
            <p className="text-lg sm:text-xl text-[var(--muted-foreground)] leading-relaxed max-w-2xl mb-8">
              Discover competitions from organizations on QuizBuzz, share the ones your community cares about, and earn rewards as your referrals turn into verified registrations.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto mb-10">
              <button
                onClick={onOpenApply}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-base bg-[var(--primary)] text-white hover:opacity-95 shadow-md hover:shadow-lg active:scale-98 transition-all"
              >
                <span>Become an Ambassador</span>
                <ArrowRight className="w-5 h-5" />
              </button>

              <button
                onClick={onExploreCampaigns}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-base bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--secondary)] active:scale-98 transition-all"
              >
                <span>Explore campaigns</span>
                <ExternalLink className="w-4 h-4 text-[var(--muted-foreground)]" />
              </button>
            </div>

            {/* Avatars and Social Proof */}
            <div className="flex items-center gap-4 pt-2 border-t border-[var(--border)]/60 w-full max-w-xl">
              <div className="flex -space-x-2.5">
                <div className="w-9 h-9 rounded-full bg-[var(--primary)] text-white font-bold text-xs flex items-center justify-center border-2 border-[var(--background)] shadow-sm">
                  AK
                </div>
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center border-2 border-[var(--background)] shadow-sm">
                  PM
                </div>
                <div className="w-9 h-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center border-2 border-[var(--background)] shadow-sm">
                  RN
                </div>
                <div className="w-9 h-9 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center border-2 border-[var(--background)] shadow-sm">
                  SD
                </div>
              </div>
              <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">
                <strong className="text-[var(--foreground)] font-semibold">100+ active ambassadors</strong> driving reach across{' '}
                <strong className="text-[var(--foreground)] font-semibold">40+ colleges &amp; clubs</strong>
              </p>
            </div>
          </div>

          {/* Right Column: Dynamic Ambassador Ecosystem Visualization */}
          <div className="lg:col-span-5 relative w-full max-w-md mx-auto">
            {/* Subtle glow behind card */}
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-tr from-[var(--primary)]/20 via-[var(--accent)]/15 to-transparent blur-xl pointer-events-none" />

            {/* Main Interactive Widget */}
            <div className="relative rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-7 shadow-xl">
              {/* Header Bar */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Live Ambassador Dashboard
                  </span>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[var(--secondary)] text-[var(--secondary-foreground)] font-medium">
                  Verified Loop
                </span>
              </div>

              {/* Impact Stats Row */}
              <div className="mb-5">
                <div className="flex items-baseline justify-between mb-1.5">
                  <span className="text-xs font-medium text-[var(--muted-foreground)]">Your Impact (This Month)</span>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +18 this week
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <div className={`text-3xl font-extrabold text-[var(--foreground)] tracking-tight transition-transform duration-300 ${justBumped ? 'scale-110 text-[var(--primary)]' : ''}`}>
                    {registrations}
                  </div>
                  <div className="text-sm font-semibold text-[var(--muted-foreground)]">
                    registrations driven
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3">
                  <div className="w-full h-2.5 rounded-full bg-[var(--muted)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[var(--primary)] to-[var(--accent)] transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] mt-1.5 font-medium">
                    <span>Level 3 (Leader Tier)</span>
                    <span>{50 - registrations > 0 ? `${50 - registrations} more to Level 4` : 'Max Tier Unlocked'}</span>
                  </div>
                </div>

                {/* Earnings Highlight */}
                <div className="mt-4 p-3 rounded-xl bg-[var(--secondary)]/70 border border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs text-[var(--muted-foreground)]">Accrued Rewards</div>
                      <div className="text-base font-extrabold text-[var(--foreground)]">₹{earnings}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-[var(--muted-foreground)]">Status</div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="w-3 h-3" /> Ready for payout
                    </span>
                  </div>
                </div>
              </div>

              {/* Active Campaign Box */}
              <div className="pt-4 border-t border-[var(--border)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
                    Active Campaign
                  </span>
                  <span className="text-xs font-semibold text-[var(--primary)]">
                    ₹25 / registration
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--background)] mb-3">
                  <div className="text-sm font-bold text-[var(--foreground)]">
                    National Aptitude Sprint 2026
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    Meridian State University • 12 days left
                  </div>

                  {/* Referral link copy thread */}
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 bg-[var(--card)] px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-mono text-[var(--foreground)] truncate select-all">
                      ysmquizbuzz.com/contest/national-aptitude-sprint-2026?ref=ABC12D
                    </div>
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] text-white hover:opacity-90 active:scale-95 flex items-center gap-1 transition-all"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                {/* Simulation button */}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[var(--muted-foreground)]">24 clicks • 18 verified</span>
                  <button
                    onClick={handleManualSimulate}
                    className="inline-flex items-center gap-1 font-semibold text-[var(--primary)] hover:underline"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Simulate +1 registration
                  </button>
                </div>
              </div>
            </div>

            {/* Floating Live Badge #1: Top Campus Rank */}
            <div className="absolute -bottom-5 -right-3 sm:-right-4 bg-[var(--card)] border border-[var(--border)] px-3.5 py-2.5 rounded-xl shadow-lg flex items-center gap-2.5 animate-pulse-gentle">
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 font-extrabold text-xs flex items-center justify-center">
                #4
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-[var(--foreground)]">Campus Rank</div>
                <div className="text-[11px] text-[var(--muted-foreground)]">Top 5 this week</div>
              </div>
            </div>

            {/* Floating Live Badge #2: Verified Payout Notification */}
            <div className="absolute -top-4 -left-3 sm:-left-4 bg-[var(--card)] border border-[var(--border)] px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs font-semibold text-[var(--foreground)]">
                ₹500 bonus unlocked
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};