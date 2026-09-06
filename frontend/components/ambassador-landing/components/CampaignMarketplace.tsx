'use client';

import React from 'react';
import { Clock, ArrowRight, Megaphone } from 'lucide-react';
import { Campaign } from '../types';

interface CampaignMarketplaceProps {
  campaigns: Campaign[];
  onSelectCampaign: (campaign: Campaign) => void;
  isLoading?: boolean;
}

export const CampaignMarketplace: React.FC<CampaignMarketplaceProps> = ({
  campaigns,
  onSelectCampaign,
  isLoading,
}) => {
  return (
    <section id="campaigns" className="py-16 md:py-24 bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            <span>OPEN CAMPAIGNS</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
            Find a campaign worth sharing.
          </h2>
          <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed">
            Browse active campaigns across QuizBuzz and choose opportunities that fit your audience, interests, and reach. Check eligibility and reward terms before applying.
          </p>
        </div>

        {/* Campaign Cards Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 rounded-2xl border border-[var(--border)] bg-[var(--card)] animate-pulse" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="mx-auto max-w-md rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)]">
              <Megaphone className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-[var(--foreground)]">No campaigns are live right now</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Check back soon, or sign up now so you're ready to apply the moment one opens.</p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((camp) => {
            const rewardDisplay = camp.rewardMax
              ? `₹${camp.rewardMin}–${camp.rewardMax}`
              : `₹${camp.rewardMin}`;

            return (
              <div
                key={camp.id}
                className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 flex flex-col justify-between hover:-translate-y-1 hover:shadow-lg hover:border-[var(--primary)]/50 transition-all duration-200 group"
              >
                <div>
                  {/* Top Org & Status Row */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-[var(--secondary)] text-[var(--primary)] font-extrabold text-[11px] flex items-center justify-center shrink-0 border border-[var(--border)]">
                        {camp.orgInitials}
                      </div>
                      <span className="text-xs font-bold text-[var(--muted-foreground)] truncate">
                        {camp.organization}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {camp.status}
                    </span>
                  </div>

                  {/* Campaign Title & Promoted Contest */}
                  <h3 className="text-lg font-bold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors mb-1">
                    {camp.name}
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)] mb-4">
                    Promoting <strong className="text-[var(--foreground)] font-semibold">{camp.promotedContest}</strong>
                  </p>

                  {/* Eligibility Tags */}
                  <div className="flex flex-wrap gap-1.5 mb-6">
                    {camp.eligibleRoles.map((role) => (
                      <span
                        key={role}
                        className="text-[11px] font-medium px-2.5 py-0.5 rounded-md bg-[var(--secondary)] text-[var(--secondary-foreground)]"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Foot: Reward & Action */}
                <div className="pt-4 border-t border-[var(--border)]">
                  <div className="flex items-baseline justify-between mb-3">
                    <div>
                      <div className="text-xl font-extrabold text-[var(--foreground)] tracking-tight">
                        {rewardDisplay}
                      </div>
                      <div className="text-[11px] text-[var(--muted-foreground)] font-medium">
                        {camp.rewardUnit}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs font-bold text-[var(--foreground)] flex items-center gap-1 justify-end">
                        <Clock className="w-3.5 h-3.5 text-amber-500" />
                        {camp.daysLeft} days left
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onSelectCampaign(camp)}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--primary)] hover:text-white transition-colors"
                  >
                    <span>View campaign details</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        )}

        {!isLoading && campaigns.length > 0 && (
          <div className="mt-8 text-center text-xs text-[var(--muted-foreground)]">
            Showing {campaigns.length} open campaign{campaigns.length === 1 ? '' : 's'} across QuizBuzz organizations.
          </div>
        )}
      </div>
    </section>
  );
};