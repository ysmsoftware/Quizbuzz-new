'use client';

import React from 'react';
import { CheckCircle2 } from 'lucide-react';

export const NetworkStats: React.FC = () => {
  const stats = [
    {
      value: '100+',
      label: 'Active Ambassadors',
      sub: 'Across 4 student & creator tracks',
    },
    {
      value: '40+',
      label: 'Colleges & Communities',
      sub: 'Universities, clubs & tech circles',
    },
    {
      value: '120+',
      label: 'Active & Past Campaigns',
      sub: 'Hosted by verified institutions',
    },
    {
      value: '10,000+',
      label: 'Registrations Driven',
      sub: 'Directly verified through referral URLs',
    },
  ];

  return (
    <section className="py-16 md:py-20 bg-[var(--background)] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--secondary)] text-[var(--secondary-foreground)] mb-3">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>VERIFIED ECOSYSTEM IMPACT</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
            A growing network behind every competition.
          </h2>
          <p className="text-base text-[var(--muted-foreground)] leading-relaxed">
            QuizBuzz Ambassadors isn't just about sharing a link — it's the distribution engine that helps great competitions fill their rosters and find the students eager to compete.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat) => {
            return (
              <div
                key={stat.label}
                className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/40 hover:shadow-md transition-all text-center flex flex-col items-center"
              >
                <div className="text-3xl sm:text-4xl font-black text-[var(--foreground)] tracking-tight mb-1">
                  {stat.value}
                </div>
                <div className="text-sm font-bold text-[var(--foreground)] mb-1">
                  {stat.label}
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {stat.sub}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};