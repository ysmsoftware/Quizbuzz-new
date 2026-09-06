'use client';

import React, { useState } from 'react';
import { Award, Zap, Sparkles, CheckCircle2, ChevronRight } from 'lucide-react';
import { REWARD_MILESTONES } from '../data/mockData';

export const RewardsProgression: React.FC = () => {
  const [sliderVal, setSliderVal] = useState<number>(42);

  const getCurrentTier = (val: number) => {
    if (val >= 100) return 4;
    if (val >= 50) return 3;
    if (val >= 25) return 2;
    return 1;
  };

  const currentLevel = getCurrentTier(sliderVal);
  const estimatedRewards = sliderVal * 25 + (currentLevel >= 2 ? 250 : 0) + (currentLevel >= 3 ? 500 : 0) + (currentLevel >= 4 ? 1250 : 0);

  return (
    <section className="py-16 md:py-24 bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            <span>PROGRESSION ARCHITECTURE</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
            The more impact you create, the further you go.
          </h2>
          <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed">
            While base rates are set per campaign, QuizBuzz provides a compounding milestone framework. Consistent referrers unlock rate boosts, cash milestones, and official leadership perks.
          </p>
        </div>

        {/* Interactive Milestone Simulator Slider */}
        <div className="max-w-3xl mx-auto p-6 sm:p-8 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-lg mb-12">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                Interactive Earnings &amp; Level Simulator
              </span>
              <div className="text-lg font-bold text-[var(--foreground)]">
                Drag to project your registrations
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="text-2xl sm:text-3xl font-black text-[var(--foreground)]">
                ₹{estimatedRewards.toLocaleString()}
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                Est. total value at {sliderVal} registrations
              </div>
            </div>
          </div>

          {/* Slider Control */}
          <div className="relative mb-6">
            <input
              type="range"
              min="0"
              max="100"
              value={sliderVal}
              onChange={(e) => setSliderVal(parseInt(e.target.value))}
              aria-label="Interactive registrations simulator"
              className="w-full h-3 rounded-full bg-[var(--muted)] appearance-none cursor-pointer accent-[var(--primary)]"
            />
            {/* Markers */}
            <div className="flex justify-between text-[11px] font-mono text-[var(--muted-foreground)] font-bold mt-2">
              <span>0 (Start)</span>
              <span>10 (Level 1)</span>
              <span>25 (Level 2)</span>
              <span>50 (Level 3)</span>
              <span>100 (Level 4)</span>
            </div>
          </div>

          {/* Current Level Status Pill */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[var(--secondary)] border border-[var(--border)]">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[var(--primary)] text-white font-black text-xs flex items-center justify-center">
                L{currentLevel}
              </div>
              <div>
                <div className="text-xs font-bold text-[var(--foreground)]">
                  {REWARD_MILESTONES[currentLevel - 1].name}
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)]">
                  {REWARD_MILESTONES[currentLevel - 1].bonus}
                </div>
              </div>
            </div>
            <span className="text-xs font-extrabold text-[var(--primary)]">
              {REWARD_MILESTONES[currentLevel - 1].rewardRate}
            </span>
          </div>
        </div>

        {/* 4 Tiers Comparison Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {REWARD_MILESTONES.map((tier) => {
            const isReached = sliderVal >= tier.registrationsRequired;
            return (
              <div
                key={tier.level}
                className={`p-6 rounded-2xl border transition-all flex flex-col justify-between ${
                  isReached
                    ? 'border-[var(--primary)] bg-[var(--card)] shadow-md ring-1 ring-[var(--primary)]/30'
                    : 'border-[var(--border)] bg-[var(--card)]/60 opacity-75'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-md bg-[var(--secondary)] text-[var(--secondary-foreground)]">
                      {tier.badge}
                    </span>
                    {isReached && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Unlocked
                      </span>
                    )}
                  </div>

                  <h3 className="text-base font-extrabold text-[var(--foreground)] mb-1">
                    {tier.name}
                  </h3>
                  <div className="text-xs text-[var(--muted-foreground)] mb-4">
                    {tier.registrationsRequired}+ verified registrations
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="p-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                      <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">
                        Reward Multiplier
                      </div>
                      <div className="text-xs font-bold text-[var(--primary)]">
                        {tier.rewardRate}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[var(--background)] border border-[var(--border)]">
                      <div className="text-[10px] uppercase font-bold text-[var(--muted-foreground)]">
                        Milestone Bonus
                      </div>
                      <div className="text-xs font-semibold text-[var(--foreground)]">
                        {tier.bonus}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-[var(--muted-foreground)] text-center pt-3 border-t border-[var(--border)]">
                  Applies across all campaigns you join
                </div>
              </div>
            );
          })}
        </div>

        {/* Disclaimer Note */}
        <p className="mt-8 text-center text-xs text-[var(--muted-foreground)] max-w-xl mx-auto">
          * Note: Base reward rates and qualification rules are specified independently by each contest organizer on the campaign page before you submit an application.
        </p>
      </div>
    </section>
  );
};