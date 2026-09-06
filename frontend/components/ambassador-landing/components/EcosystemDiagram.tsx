'use client';

import React, { useState } from 'react';
import { Building2, Cpu, Megaphone, Users, Trophy, Repeat, ArrowRight, ArrowDown } from 'lucide-react';

export const EcosystemDiagram: React.FC = () => {
  const [activeStep, setActiveStep] = useState<number>(2); // Default to Ambassador

  const nodes = [
    {
      id: 0,
      title: 'ORGANIZER',
      tag: 'Launches Campaign',
      desc: 'Colleges, departments, and hackathon organizers create competitions and set clear participant targets with dedicated referral reward pools.',
      icon: Building2,
      badge: 'Step 1: Supply',
    },
    {
      id: 1,
      title: 'QUIZBUZZ',
      tag: 'Platform & Infrastructure',
      desc: 'Powers the contest engine, verifies eligibility, hosts the secure testing interface, and generates tamper-proof attribution tracking links.',
      icon: Cpu,
      badge: 'Step 2: Core Platform',
    },
    {
      id: 2,
      title: 'AMBASSADOR',
      tag: 'The Distribution Layer',
      desc: 'Campus leads, student enthusiasts, and creators discover campaigns that fit their peers, sharing tailored links across classrooms, clubs, and social channels.',
      icon: Megaphone,
      badge: 'Step 3: Growth Network',
    },
    {
      id: 3,
      title: 'COMMUNITY & PARTICIPANTS',
      tag: 'Authentic Reach',
      desc: 'Students receive direct, relevant recommendations from peers they trust, register in 2 clicks, and enter the contest.',
      icon: Users,
      badge: 'Step 4: Demand',
    },
    {
      id: 4,
      title: 'CONTEST & REWARDS',
      tag: 'Measurable Impact',
      desc: 'The competition fills its leaderboard, winners are certified, and ambassadors receive automated, verified payouts.',
      icon: Trophy,
      badge: 'Step 5: Completion',
    },
  ];

  const flywheels = [
    { label: 'More reach', desc: 'Campaigns reach targeted college circles' },
    { label: 'More registrations', desc: 'Verified students enter the contest' },
    { label: 'Bigger competitions', desc: 'Prize pools expand and rankings matter more' },
    { label: 'More opportunities', desc: 'Organizers return to run larger campaigns' },
    { label: 'Ambassador rewards', desc: 'You unlock higher tiers and milestone payouts' },
  ];

  return (
    <section id="ecosystem" className="py-16 md:py-24 bg-[var(--card)] border-y border-[var(--border)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            <span>THE NETWORK</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] mb-4">
            Competitions are better when they reach the right people.
          </h2>
          <p className="text-lg text-[var(--muted-foreground)] leading-relaxed">
            You're not just sharing a link. You're bridging the gap between institutions hosting great challenges and the participants who would thrive in them.
          </p>
        </div>

        {/* Interactive Diagram Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center mb-16">
          {/* Left Column: The 5-Node Vertical Flow */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            {nodes.map((node, index) => {
              const Icon = node.icon;
              const isSelected = activeStep === node.id;
              return (
                <div key={node.id}>
                  <div
                    onClick={() => setActiveStep(node.id)}
                    className={`cursor-pointer p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex items-start gap-4 ${
                      isSelected
                        ? 'border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))] shadow-md scale-[1.01]'
                        : 'border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]/40 hover:bg-[var(--card)]'
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[var(--primary)] text-white'
                          : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm tracking-tight text-[var(--foreground)]">
                            {node.title}
                          </span>
                          <span className="text-xs text-[var(--muted-foreground)] font-medium">
                            • {node.tag}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[var(--secondary)] text-[var(--secondary-foreground)] shrink-0">
                          {node.badge}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-[var(--muted-foreground)] leading-relaxed">
                        {node.desc}
                      </p>
                    </div>
                  </div>

                  {/* Flow Connector Arrow */}
                  {index < nodes.length - 1 && (
                    <div className="flex justify-center my-1 text-[var(--muted-foreground)]/50">
                      <ArrowDown className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column: The Growth Flywheel Loop */}
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full p-6 sm:p-7 rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-lg relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 mb-5 border-b border-[var(--border)]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/15 text-[var(--primary)] flex items-center justify-center">
                    <Repeat className="w-4 h-4 animate-spin" style={{ animationDuration: '14s' }} />
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--primary)]">
                      The QuizBuzz Flywheel
                    </div>
                    <div className="text-sm font-bold text-[var(--foreground)]">
                      Sustainable Growth Loop
                    </div>
                  </div>
                </div>
              </div>

              {/* Flywheel Steps */}
              <div className="flex flex-col gap-3">
                {flywheels.map((fw, idx) => (
                  <div
                    key={fw.label}
                    className="flex items-start gap-3 p-3 rounded-xl bg-[var(--card)] border border-[var(--border)]"
                  >
                    <div className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-[var(--foreground)]">{fw.label}</div>
                      <div className="text-[11px] text-[var(--muted-foreground)]">{fw.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary Callout Box */}
              <div className="mt-6 p-3.5 rounded-xl bg-[var(--secondary)] text-xs text-[var(--secondary-foreground)] border border-[var(--border)] leading-relaxed">
                <strong>Why this matters:</strong> Organizers get authentic student reach without expensive agency advertising. Ambassadors unlock real income and leadership credit. Students discover competitions that advance their careers.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};