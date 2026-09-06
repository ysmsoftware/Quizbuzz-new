'use client';

import React from 'react';
import { GraduationCap, Award, Globe, Check, ArrowRight } from 'lucide-react';
import { AmbassadorRole } from '../types';

interface AmbassadorTypesProps {
  onSelectRoleForApply: (role: AmbassadorRole) => void;
}

export const AmbassadorTypes: React.FC<AmbassadorTypesProps> = ({ onSelectRoleForApply }) => {
  const tracks = [
    {
      role: 'Student Ambassador' as AmbassadorRole,
      title: 'Student Ambassador',
      icon: GraduationCap,
      color: 'var(--primary)',
      tagline: 'Bring competitions to your classmates, study cohorts & campus clubs.',
      whoItsFor: 'Undergraduates, postgraduates, and diploma scholars enrolled in an accredited college.',
      bestFor: 'Class WhatsApp groups, departmental fests, hostel study circles, campus clubs.',
      perks: ['Easy student ID verification', 'Campus leaderboard recognition', 'Early access to competition benchmarks'],
    },
    {
      role: 'Faculty Ambassador' as AmbassadorRole,
      title: 'Faculty Ambassador',
      icon: Award,
      color: 'oklch(0.65 0.14 180)',
      tagline: 'Empower students through classroom challenges, departmental notices & mentorship.',
      whoItsFor: 'Professors, department heads, placement coordinators, lecturers, and academic mentors.',
      bestFor: 'Official classroom circulars, departmental noticeboards, academic syllabus tie-ins.',
      perks: ['Institutional coordinator credentials', 'Priority organizer support', 'Official academic citation & certificates'],
    },
    {
      role: 'General Ambassador' as AmbassadorRole,
      title: 'General Ambassador',
      icon: Globe,
      color: 'oklch(0.85 0.15 85)',
      tagline: 'Connect broader student networks, youth communities & cross-college learners.',
      whoItsFor: 'Alumni, education creators, community organizers, youth mentors, and quiz leads.',
      bestFor: 'Social channels, inter-college groups, Discord/Telegram study servers, alumni networks.',
      perks: ['Custom branded referral links', 'Flexible cross-campus eligibility', 'Weekly batch payouts & bonus pools'],
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-[var(--background)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            <span>FIND YOUR TRACK</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
            There's more than one way to be an ambassador.
          </h2>
          <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed">
            Whether you study in a classroom cohort, guide and mentor students as faculty, or mobilize learners through open communities, there's a distribution role tailored to you.
          </p>
        </div>

        {/* 3 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tracks.map((track) => {
            const Icon = track.icon;
            return (
              <div
                key={track.role}
                className="p-7 rounded-2xl border border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between group"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-[var(--secondary)] text-[var(--primary)] group-hover:bg-[var(--primary)] group-hover:text-white flex items-center justify-center mb-4 transition-colors">
                    <Icon className="w-6 h-6" />
                  </div>

                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] mb-1 block">
                    {track.title} Track
                  </span>
                  <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">
                    {track.title}
                  </h3>
                  <p className="text-xs font-medium text-[var(--foreground)] leading-relaxed mb-4">
                    {track.tagline}
                  </p>

                  <div className="space-y-3 pt-3 border-t border-[var(--border)] text-xs">
                    <div>
                      <span className="font-bold text-[var(--muted-foreground)] block mb-0.5">
                        Who it's for:
                      </span>
                      <span className="text-[var(--foreground)] leading-snug">
                        {track.whoItsFor}
                      </span>
                    </div>

                    <div>
                      <span className="font-bold text-[var(--muted-foreground)] block mb-0.5">
                        Key perks:
                      </span>
                      <ul className="space-y-1.5 text-[var(--foreground)]">
                        {track.perks.map((p) => (
                          <li key={p} className="flex items-start gap-1.5 text-[11px]">
                            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{p}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[var(--border)]">
                  <button
                    onClick={() => onSelectRoleForApply(track.role)}
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-[var(--secondary)] text-[var(--foreground)] hover:bg-[var(--primary)] hover:text-white transition-colors"
                  >
                    <span>Apply as {track.title}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};