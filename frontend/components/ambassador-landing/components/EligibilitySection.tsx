'use client';

import React from 'react';
import { CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';

export const EligibilitySection: React.FC = () => {
  const criteria = [
    {
      title: 'Active Community Access or Network',
      desc: 'Enrolled in a recognized college/university, active in student groups, running a tech channel, or leading a campus club with genuine peer reach.',
    },
    {
      title: 'Authentic Identity Verification',
      desc: 'Able to verify basic details (college email, student ID card, or public creator profile link) to protect against fraudulent traffic.',
    },
    {
      title: 'Ethical & Responsible Promotion',
      desc: 'Commitment to sharing relevant competitions naturally in context—no spamming, link-farming, bot traffic, or deceptive claims.',
    },
    {
      title: 'Active Campaign Cycle Commitment',
      desc: 'Willingness to support the competition throughout its registration period and help answer peer queries about contest dates and formats.',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-4xl mx-auto rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 sm:p-12 shadow-sm">
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
              <span>CRITERIA &amp; STANDARDS</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
              Built for people who can move communities.
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
              We uphold high trust standards across QuizBuzz. Organizers trust our network because ambassadors represent genuine, verified student voices.
            </p>
          </div>

          {/* 4 Points Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {criteria.map((item, index) => (
              <div
                key={item.title}
                className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--background)] flex items-start gap-4"
              >
                <div className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--foreground)] mb-1">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Notice Banner */}
          <div className="p-4 rounded-xl bg-[var(--secondary)]/70 border border-[var(--border)] flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-[var(--primary)] shrink-0 mt-0.5" />
            <div className="text-xs text-[var(--foreground)] leading-relaxed">
              <strong>Important Campaign-Specific Rule:</strong> While basic ambassador registration approves your account network-wide, individual campaign hosts may specify specific branch restrictions (e.g., Computer Science only) or regional prerequisites. Always check campaign details before applying.
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};