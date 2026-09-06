'use client';

import { useState } from 'react';
import {
  FileText,
  CreditCard,
  Table,
  Video,
  HelpCircle,
  BarChart3,
  Award,
  ArrowDown,
  Check,
  X,
  Layers
} from 'lucide-react';

export function ReplaceStack() {
  const [activeTool, setActiveTool] = useState<number | null>(null);

  const fragmentedTools = [
    {
      name: 'Google Forms',
      role: 'Registration & collection',
      pain: 'No seat gating, duplicate entries, manual verification',
      icon: FileText,
    },
    {
      name: 'Payment Links',
      role: 'Fee collection',
      pain: 'Manual reconciliations against registration emails',
      icon: CreditCard,
    },
    {
      name: 'Google Sheets',
      role: 'Roster & eligibility',
      pain: 'Broken formulas, vlookup errors, slow sharing',
      icon: Table,
    },
    {
      name: 'Zoom / Meet',
      role: 'Manual proctoring',
      pain: '1 proctor per 25 users, noisy, unrecorded evidence',
      icon: Video,
    },
    {
      name: 'Basic Quiz Tools',
      role: 'Question delivery',
      pain: 'Lag under 500+ users, leaky links, easily shared tabs',
      icon: HelpCircle,
    },
    {
      name: 'External Leaderboard',
      role: 'Score tallying',
      pain: 'Manual score uploads, 2-hour delay between rounds',
      icon: BarChart3,
    },
    {
      name: 'Certificate Generator',
      role: 'Post-event PDF mailer',
      pain: 'Unverified PDFs easily doctored in Photoshop',
      icon: Award,
    },
  ];

  return (
    <section className="py-20 bg-[var(--background)] border-b border-[var(--border)] relative overflow-hidden" id="platform">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-4">
            <Layers className="w-3.5 h-3.5" />
            The Unified Paradigm
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
            Running a contest shouldn't require seven different tools.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            Stop stitching together forms, payments, spreadsheets, and video calls —<br />
            QuizBuzz connects every stage of the contest from the start.
          </p>
        </div>

        {/* Fragmented Tool Stack Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-10">
          {fragmentedTools.map((tool, idx) => {
            const Icon = tool.icon;
            const isHovered = activeTool === idx;
            return (
              <div
                key={idx}
                onMouseEnter={() => setActiveTool(idx)}
                onMouseLeave={() => setActiveTool(null)}
                className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${
                  isHovered
                    ? 'border-red-400/80 bg-red-500/5 dark:bg-red-950/10 shadow-sm -translate-y-1'
                    : 'border-[var(--border)] bg-[var(--card)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 rounded-lg bg-[var(--secondary)] text-[var(--muted-foreground)]">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-600 dark:text-red-400 font-semibold flex items-center gap-1">
                    <X className="w-3 h-3" />
                    Fragmented
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[var(--foreground)]">{tool.name}</h4>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{tool.role}</p>
                <p className="text-[11px] text-red-600/90 dark:text-red-400/90 mt-2 font-medium leading-tight">
                  ⚠️ {tool.pain}
                </p>
              </div>
            );
          })}

          {/* Unified Solution 8th Card */}
          <div className="p-5 rounded-xl border-2 border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_8%,var(--card))] shadow-md flex flex-col justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--primary)] text-[var(--primary-foreground)]">
                <Check className="w-3 h-3" />
                Solved
              </span>
              <h4 className="text-base font-extrabold text-[var(--foreground)] mt-2">
                All 7 In One Place
              </h4>
              <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-relaxed">
                Zero data sync errors. Zero third-party webhooks. Zero student confusion.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs font-bold text-[var(--primary)]">
              <span>QuizBuzz Engine</span>
              <span>100% Native</span>
            </div>
          </div>
        </div>

        {/* Collapsing Animation Showcase Banner */}
        <div className="p-6 md:p-8 rounded-2xl bg-gradient-to-r from-[var(--secondary)] via-[var(--card)] to-[var(--secondary)] border border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-xl">
            <span className="text-xs font-mono font-bold uppercase text-[var(--primary)]">
              Before vs After QuizBuzz
            </span>
            <h3 className="text-xl font-bold text-[var(--foreground)] mt-1">
              "We used to spend 4 days consolidating spreadsheets after every inter-college sprint."
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] mt-2">
              With QuizBuzz, rankings calculate instantaneously, integrity reviews are complete before tea break, and certificates are signed and verified automatically.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
            <div className="p-3 bg-[var(--card)] border border-[var(--border)] rounded-xl text-center w-full sm:w-36">
              <span className="text-[11px] text-[var(--muted-foreground)] block">Old Stack Overhead</span>
              <span className="font-mono text-lg font-bold text-red-500">12+ Hours</span>
            </div>
            <div className="hidden sm:block text-[var(--muted-foreground)]">→</div>
            <div className="p-3 bg-[color-mix(in_oklch,var(--primary)_12%,var(--card))] border border-[var(--primary)] rounded-xl text-center w-full sm:w-36">
              <span className="text-[11px] text-[var(--primary)] block font-semibold">QuizBuzz Time</span>
              <span className="font-mono text-lg font-bold text-[var(--foreground)]">&lt; 15 Mins</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}