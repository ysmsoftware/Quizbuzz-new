'use client';

import React, { useState } from 'react';
import { Share2, MousePointerClick, UserCheck, ShieldCheck, Banknote, Sparkles, Copy, Check } from 'lucide-react';

export const ReferralFunnelTracking: React.FC = () => {
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const steps = [
    {
      id: 'share',
      label: 'Shared',
      sublabel: 'Campaign link dispatched',
      metric: 'Your unique slug',
      desc: 'You post your link or QR code to student club WhatsApp groups, Discord servers, or college fests.',
      icon: Share2,
      color: 'var(--primary)',
    },
    {
      id: 'click',
      label: 'Clicked',
      sublabel: 'Traffic arrives on QuizBuzz',
      metric: '142 Clicks',
      desc: 'Participants open the contest landing page. QuizBuzz drops a secure 30-day attribution cookie.',
      icon: MousePointerClick,
      color: 'oklch(0.65 0.14 180)',
    },
    {
      id: 'register',
      label: 'Registered',
      sublabel: 'Student enters competition',
      metric: '48 Registrations',
      desc: 'The student signs up for the competition using their verified student email or mobile number.',
      icon: UserCheck,
      color: 'oklch(0.6 0.16 145)',
    },
    {
      id: 'qualify',
      label: 'Qualified',
      sublabel: 'Eligibility verified',
      metric: '42 Qualified',
      desc: 'Our system automatically verifies legitimate student status to protect organizer budgets.',
      icon: ShieldCheck,
      color: 'oklch(0.75 0.12 85)',
    },
    {
      id: 'reward',
      label: 'Rewarded',
      sublabel: 'Credited to your wallet',
      metric: '₹1,050 Earned',
      desc: 'The campaign payout rule triggers instantly, crediting your ambassador balance for direct payout.',
      icon: Banknote,
      color: 'oklch(0.85 0.15 85)',
    },
  ];

  const handleCopyLink = () => {
    navigator.clipboard?.writeText('https://ysmquizbuzz.com/contest/national-aptitude-sprint-2026?ref=ABC12D');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunSimulation = () => {
    if (isSimulating) return;
    setIsSimulating(true);
    setActiveStepIndex(0);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < steps.length) {
        setActiveStepIndex(step);
      } else {
        clearInterval(interval);
        setIsSimulating(false);
      }
    }, 700);
  };

  return (
    <section className="py-16 md:py-24 bg-[var(--background)] relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            <span>TRACK EVERY REFERRAL</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
            Every campaign gets its own path.
          </h2>
          <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed">
            Share a campaign-specific link and see what happens after you send it—from the very first click to completed registration and verified payout.
          </p>
        </div>

        {/* Central Anchor: The Visual Referral Link Thread */}
        <div className="max-w-xl mx-auto mb-12 p-4 sm:p-5 rounded-2xl border-2 border-dashed border-[var(--primary)]/50 bg-[var(--card)] shadow-sm text-center">
          <div className="text-xs font-bold uppercase tracking-wider text-[var(--muted-foreground)] mb-2">
            Your Campaign Link
          </div>
          <div className="flex items-center justify-between gap-3 p-2 rounded-xl bg-[var(--background)] border border-[var(--border)]">
            <span className="font-mono text-xs sm:text-sm font-bold text-[var(--primary)] pl-2 truncate select-all">
              ysmquizbuzz.com/contest/national-aptitude-sprint-2026?ref=ABC12D
            </span>
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--primary)] text-white hover:opacity-90 flex items-center gap-1.5 shrink-0 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* The 5-Step Horizontal Funnel */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative mb-10">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCurrent = activeStepIndex === idx;
            const isPassed = activeStepIndex >= idx;

            return (
              <div
                key={step.id}
                onClick={() => setActiveStepIndex(idx)}
                className={`cursor-pointer p-5 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                  isCurrent
                    ? 'border-[var(--primary)] bg-[var(--card)] shadow-lg -translate-y-1 ring-2 ring-[var(--primary)]/20'
                    : isPassed
                    ? 'border-[var(--border)] bg-[var(--card)] shadow-sm'
                    : 'border-[var(--border)] bg-[var(--card)]/60 opacity-80'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                        isPassed
                          ? 'bg-[var(--primary)] text-white'
                          : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-[var(--muted-foreground)]">
                      0{idx + 1}
                    </span>
                  </div>

                  <div className="text-base font-extrabold text-[var(--foreground)] mb-0.5">
                    {step.label}
                  </div>
                  <div className="text-xs font-bold text-[var(--primary)] mb-2">
                    {step.metric}
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                    {step.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
                  <span>{step.sublabel}</span>
                  {isPassed && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Simulation CTA button */}
        <div className="text-center">
          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--muted)] border border-[var(--border)] transition-all shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-[var(--primary)] animate-spin" style={{ animationDuration: '4s' }} />
            <span>{isSimulating ? 'Simulating visitor journey...' : 'Simulate participant conversion journey'}</span>
          </button>
        </div>
      </div>
    </section>
  );
};