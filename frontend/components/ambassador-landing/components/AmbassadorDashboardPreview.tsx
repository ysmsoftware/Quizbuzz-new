'use client';

import React, { useState } from 'react';
import { Copy, Check, TrendingUp, Award, Zap, BarChart2, Calendar, ExternalLink, ShieldCheck, ArrowRight } from 'lucide-react';

export const AmbassadorDashboardPreview: React.FC = () => {
  const [period, setPeriod] = useState<'thisMonth' | 'allTime'>('thisMonth');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const stats = period === 'thisMonth'
    ? { earned: 2840, registrations: 128, clicks: 420, rank: 4, conversion: '30.4%' }
    : { earned: 8460, registrations: 374, clicks: 1280, rank: 3, conversion: '29.2%' };

  // Sample data points for registration chart (7 days / milestones)
  const chartPoints = period === 'thisMonth'
    ? [
        { label: 'Sep 01', count: 12 },
        { label: 'Sep 05', count: 18 },
        { label: 'Sep 10', count: 26 },
        { label: 'Sep 15', count: 44 },
        { label: 'Sep 20', count: 72 },
        { label: 'Sep 25', count: 98 },
        { label: 'Sep 30', count: 128 },
      ]
    : [
        { label: 'Jun', count: 48 },
        { label: 'Jul', count: 110 },
        { label: 'Aug', count: 236 },
        { label: 'Sep', count: 374 },
      ];

  const activeCampaigns = [
    {
      id: 'aptitude',
      name: 'National Aptitude Sprint',
      org: 'Meridian State University',
      regs: 48,
      earned: 1200,
      link: 'ysmquizbuzz.com/contest/national-aptitude-sprint-2026?ref=ABC12D',
    },
    {
      id: 'coding',
      name: 'Winter Coding Cup',
      org: 'Ashcroft Institute of Tech',
      regs: 36,
      earned: 720,
      link: 'ysmquizbuzz.com/contest/winter-coding-cup-2026?ref=ABC12D',
    },
    {
      id: 'commerce',
      name: 'Inter-College Commerce Quiz',
      org: 'Northfield College of Commerce',
      regs: 44,
      earned: 920,
      link: 'ysmquizbuzz.com/contest/inter-college-commerce-quiz?ref=ABC12D',
    },
  ];

  const handleCopy = (link: string, id: string) => {
    navigator.clipboard?.writeText(`https://${link}`);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <section id="dashboard" className="py-16 md:py-24 bg-[var(--card)] border-y border-[var(--border)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            <span>YOUR DASHBOARD</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
            Your reach. Your campaigns. Your progress.
          </h2>
          <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed">
            Here's what you get right after joining: real-time attribution, live referral link performance, payout audit trails, and campaign management in one unified workspace.
          </p>
        </div>

        {/* Dashboard Shell Mockup */}
        <div className="max-w-5xl mx-auto rounded-2xl border border-[var(--border)] bg-[var(--background)] shadow-2xl overflow-hidden">
          {/* Top Bar of the Dashboard */}
          <div className="px-6 py-4 border-b border-[var(--border)] bg-[var(--card)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white font-black flex items-center justify-center text-sm shadow-sm">
                A
              </div>
              <div>
                <div className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                  Good evening, Austin
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    Verified Ambassador
                  </span>
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  Meridian Chapter • Level 3 Contributor
                </div>
              </div>
            </div>

            {/* Timeframe selector */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--secondary)] border border-[var(--border)] text-xs font-semibold">
              <button
                onClick={() => setPeriod('thisMonth')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  period === 'thisMonth'
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs font-bold'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                September (Current)
              </button>
              <button
                onClick={() => setPeriod('allTime')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  period === 'allTime'
                    ? 'bg-[var(--card)] text-[var(--foreground)] shadow-xs font-bold'
                    : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                }`}
              >
                All-Time Portfolio
              </button>
            </div>
          </div>

          {/* Main Dashboard Body */}
          <div className="p-6 sm:p-8 space-y-6">
            {/* KPI Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <div className="text-xs text-[var(--muted-foreground)] font-medium mb-1">
                  Accrued Rewards
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[var(--foreground)] tracking-tight">
                  ₹{stats.earned.toLocaleString()}
                </div>
                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3.5 h-3.5" /> +₹640 this week
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <div className="text-xs text-[var(--muted-foreground)] font-medium mb-1">
                  Registrations Driven
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[var(--foreground)] tracking-tight">
                  {stats.registrations}
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)] font-medium mt-1">
                  {stats.clicks} tracked clicks ({stats.conversion} conv)
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <div className="text-xs text-[var(--muted-foreground)] font-medium mb-1">
                  Campus Leaderboard
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[var(--foreground)] tracking-tight">
                  #{stats.rank}
                </div>
                <div className="text-[11px] text-amber-500 font-semibold mt-1 flex items-center gap-1">
                  <Award className="w-3.5 h-3.5" /> Top 5 percentile
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                <div className="text-xs text-[var(--muted-foreground)] font-medium mb-1">
                  Active Campaigns
                </div>
                <div className="text-2xl sm:text-3xl font-black text-[var(--foreground)] tracking-tight">
                  3
                </div>
                <div className="text-[11px] text-[var(--primary)] font-semibold mt-1">
                  All 3 verified &amp; active
                </div>
              </div>
            </div>

            {/* Registration Progress Chart Section */}
            <div className="p-5 sm:p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-[var(--foreground)]">
                    Cumulative Registrations Trajectory
                  </h4>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Hover over points to see daily milestone attribution
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-[var(--primary)] px-2.5 py-1 rounded-md bg-[var(--primary)]/10">
                  +34% Growth MoM
                </span>
              </div>

              {/* Simplified Responsive SVG Line Chart */}
              <div className="relative h-44 w-full flex items-end pt-4">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 700 140" preserveAspectRatio="none">
                  {/* Subtle Grid Lines */}
                  <line x1="0" y1="35" x2="700" y2="35" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="70" x2="700" y2="70" stroke="currentColor" strokeOpacity="0.08" />
                  <line x1="0" y1="105" x2="700" y2="105" stroke="currentColor" strokeOpacity="0.08" />

                  {/* Gradient Fill under line */}
                  <defs>
                    <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Area */}
                  <path
                    d="M 0 130 L 0 120 C 120 110, 220 95, 350 65 C 480 35, 580 20, 700 8 L 700 140 L 0 140 Z"
                    fill="url(#chartGrad)"
                  />

                  {/* Stroke Line */}
                  <path
                    d="M 0 120 C 120 110, 220 95, 350 65 C 480 35, 580 20, 700 8"
                    fill="none"
                    stroke="var(--primary)"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />

                  {/* Interactive Nodes */}
                  {chartPoints.map((pt, idx) => {
                    const cx = (idx / (chartPoints.length - 1)) * 680 + 10;
                    // Approximate curve Y positions
                    const cy = 130 - (pt.count / (period === 'thisMonth' ? 140 : 400)) * 120;
                    const isHovered = hoveredPoint === idx;

                    return (
                      <g key={pt.label}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isHovered ? 6 : 4}
                          className="fill-[var(--card)] stroke-[var(--primary)] stroke-[3] transition-all cursor-pointer"
                          onMouseEnter={() => setHoveredPoint(idx)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Hover Tooltip display */}
                {hoveredPoint !== null && (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-[var(--foreground)] text-[var(--background)] px-3 py-1 rounded-lg text-xs font-bold shadow-lg pointer-events-none">
                    {chartPoints[hoveredPoint].label}: {chartPoints[hoveredPoint].count} verified registrations
                  </div>
                )}
              </div>

              {/* Chart X-axis Labels */}
              <div className="flex justify-between text-[11px] text-[var(--muted-foreground)] font-medium mt-2">
                {chartPoints.map((pt) => (
                  <span key={pt.label}>{pt.label}</span>
                ))}
              </div>
            </div>

            {/* Active Campaigns Table */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden">
              <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--foreground)]">
                  Active Campaign Links &amp; Attribution
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">3 active links</span>
              </div>

              <div className="divide-y divide-[var(--border)]">
                {activeCampaigns.map((camp) => (
                  <div
                    key={camp.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[var(--secondary)]/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-[var(--foreground)]">
                        {camp.name}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        {camp.org}
                      </div>
                      <div className="mt-1.5 inline-flex items-center gap-2 bg-[var(--background)] border border-[var(--border)] px-2.5 py-1 rounded-lg text-xs font-mono text-[var(--primary)] max-w-full truncate">
                        <span>{camp.link}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0">
                      <div className="text-left sm:text-right">
                        <div className="text-sm font-extrabold text-[var(--foreground)]">
                          {camp.regs} regs
                        </div>
                        <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          ₹{camp.earned} earned
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(camp.link, camp.id)}
                          className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--background)] hover:bg-[var(--primary)] hover:text-white hover:border-[var(--primary)] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                        >
                          {copiedLink === camp.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Table Footer with Social Preview Callout */}
              <div className="p-3.5 bg-[var(--secondary)]/40 border-t border-[var(--border)] flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-[var(--muted-foreground)]">
                  QuizBuzz links automatically unfurl rich previews when pasted into WhatsApp, Twitter, or Discord.
                </span>
                <button
                  onClick={() => {
                    const el = document.getElementById('toolkit');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="font-bold text-[var(--primary)] hover:underline flex items-center gap-1 shrink-0"
                >
                  <span>Preview Social Share</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};