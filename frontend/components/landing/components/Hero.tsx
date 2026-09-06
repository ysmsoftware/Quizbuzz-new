'use client';

import { useState, useEffect } from 'react';
import {
  ArrowRight,
  Shield,
  Clock,
  Award,
  Users,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCcw,
  Sparkles,
  Search
} from 'lucide-react';
import { SAMPLE_LEADERBOARD, SAMPLE_PROCTOR_ALERTS } from '../data/mockData';

interface HeroProps {
  onCreateContest: () => void;
  onExploreContests: () => void;
}

export function Hero({ onCreateContest, onExploreContests }: HeroProps) {
  const [activeStage, setActiveStage] = useState<number>(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);
  const [timerSeconds, setTimerSeconds] = useState<number>(42 * 60 + 18);
  const [participantCount, setParticipantCount] = useState<number>(2104);

  // Auto-play through stages
  useEffect(() => {
    if (!isAutoPlaying) return;
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % 5);
    }, 3800);
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  // Live countdown timer in hero room
  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 45 * 60));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const stages = [
    { id: 0, label: '1. Registration', badge: 'OPEN' },
    { id: 1, label: '2. Check-in', badge: 'VERIFIED' },
    { id: 2, label: '3. Live Room', badge: '● LIVE' },
    { id: 3, label: '4. Integrity', badge: 'MONITORED' },
    { id: 4, label: '5. Results & Certs', badge: 'VERIFIED' },
  ];

  return (
    <section className="relative pt-12 pb-20 md:pt-16 md:pb-28 overflow-hidden border-b border-[var(--border)]">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-radial from-[color-mix(in_oklch,var(--primary)_16%,transparent)] via-[color-mix(in_oklch,var(--accent)_10%,transparent)] to-transparent blur-3xl opacity-70" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hero Copy */}
        <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-6 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse" />
            Contest Infrastructure
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[var(--foreground)] leading-[1.08] text-balance">
            Everything behind a{' '}
            <span className="text-[var(--primary)] relative inline-block">
              great online contest.
            </span>
          </h1>

          <p className="mt-5 text-lg sm:text-xl text-[var(--muted-foreground)] leading-relaxed max-w-2xl mx-auto font-normal">
            Create, run, monitor, and certify competitions from one platform —<br />
            registration, payments, proctoring, live rankings, and certificates.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <button
              onClick={onCreateContest}
              className="px-6 py-3 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-semibold text-sm shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5 flex items-center gap-2 cursor-pointer"
              id="hero-create-btn"
            >
              Create a contest
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onExploreContests}
              className="px-6 py-3 rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] font-semibold text-sm hover:bg-[var(--secondary)] transition-all cursor-pointer flex items-center gap-2"
              id="hero-explore-btn"
            >
              <Search className="w-4 h-4 text-[var(--muted-foreground)]" />
              Explore contests
            </button>
          </div>

        </div>

        {/* Signature Interactive Contest Dashboard Visualization */}
        <div className="max-w-5xl mx-auto">
          {/* Stage Switcher Controls */}
          <div className="flex items-center justify-between gap-2 mb-3 px-1 flex-wrap">
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
              {stages.map((st) => (
                <button
                  key={st.id}
                  onClick={() => {
                    setActiveStage(st.id);
                    setIsAutoPlaying(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${activeStage === st.id
                      ? 'bg-[var(--primary)] text-[var(--primary-foreground)] shadow-xs'
                      : 'bg-[var(--card)] text-[var(--muted-foreground)] border border-[var(--border)] hover:text-[var(--foreground)]'
                    }`}
                >
                  {st.label}
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-mono ${activeStage === st.id
                        ? 'bg-black/20 text-white'
                        : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'
                      }`}
                  >
                    {st.badge}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)] ml-auto">
              <button
                onClick={() => setIsAutoPlaying(!isAutoPlaying)}
                className="flex items-center gap-1 px-2.5 py-1 rounded border border-[var(--border)] hover:bg-[var(--secondary)] transition-colors cursor-pointer"
                title={isAutoPlaying ? 'Pause lifecycle animation' : 'Resume animation'}
              >
                {isAutoPlaying ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-ping" />
                    <span>Auto-touring</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>Resume tour</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Main Dashboard Window */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden transition-all duration-300">
            {/* Window Topbar */}
            <div className="px-4 py-3 bg-[var(--secondary)]/80 border-b border-[var(--border)] flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="h-4 w-px bg-[var(--border)]" />
                <span className="font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                  National Aptitude Sprint 2026
                  <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                    ID: QB-NAS-26
                  </span>
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[color-mix(in_oklch,var(--warning)_25%,var(--card))] text-[var(--accent-foreground)] border border-[color-mix(in_oklch,var(--warning)_30%,var(--border))]">
                  <span className="w-2 h-2 rounded-full bg-[var(--destructive)] animate-pulse" />
                  LIVE COMPETITION
                </span>
                <span className="font-mono text-xs font-bold text-[var(--foreground)] bg-[var(--card)] px-2.5 py-0.5 rounded border border-[var(--border)]">
                  {formatTimer(timerSeconds)}
                </span>
              </div>
            </div>

            {/* Quick Metrics Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-[var(--border)] bg-[var(--card)] divide-x divide-[var(--border)]">
              <div className="p-4">
                <span className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider block font-semibold">
                  Registered
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold text-[var(--foreground)]">2,318</span>
                  <span className="text-xs text-[var(--muted-foreground)]">/ 5,000</span>
                </div>
              </div>

              <div className="p-4">
                <span className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider block font-semibold">
                  Active in Room
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold text-[var(--primary)]">
                    {participantCount.toLocaleString()}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--success)] font-mono font-bold">
                    91% connected
                  </span>
                </div>
              </div>

              <div className="p-4">
                <span className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider block font-semibold">
                  Answers Submitted
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold text-[var(--foreground)]">68,421</span>
                  <span className="text-xs text-[var(--muted-foreground)]">50 Qs</span>
                </div>
              </div>

              <div className="p-4">
                <span className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider block font-semibold">
                  Integrity Health
                </span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-mono font-bold text-[var(--success)]">99.8%</span>
                  <span className="text-xs text-[var(--warning)] font-mono font-semibold">2 reviews</span>
                </div>
              </div>
            </div>

            {/* Dynamic Stage View */}
            <div className="p-5 md:p-6 bg-[var(--background)]/50 min-h-[320px] flex flex-col justify-center">
              {/* STAGE 0: REGISTRATION */}
              {activeStage === 0 && (
                <div className="animate-in fade-in duration-300 grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
                  <div className="md:col-span-2 bg-[var(--card)] p-5 rounded-xl border border-[var(--border)] shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                      <div>
                        <h4 className="font-bold text-sm text-[var(--foreground)]">
                          Contest Registration Gateway
                        </h4>
                        <p className="text-xs text-[var(--muted-foreground)]">
                          Custom fields mapped directly to exam cell cohorts
                        </p>
                      </div>
                      <span className="text-xs font-mono font-semibold text-[var(--primary)] px-2 py-0.5 rounded bg-[var(--secondary)]">
                        ₹49 Entry (Free for Campus)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                      <div>
                        <label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                          Participant Name
                        </label>
                        <div className="mt-1 px-3 py-2 bg-[var(--secondary)] rounded-md border border-[var(--border)] font-medium">
                          Aarav Sharma
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                          Institution
                        </label>
                        <div className="mt-1 px-3 py-2 bg-[var(--secondary)] rounded-md border border-[var(--border)] font-medium">
                          MIT Pune (Computer Eng)
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                          Verification Method
                        </label>
                        <div className="mt-1 px-3 py-2 bg-[var(--secondary)] rounded-md border border-[var(--border)] flex items-center gap-1.5 text-[var(--success)]">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Student ID + Email OTP
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                          Seat Allocated
                        </label>
                        <div className="mt-1 px-3 py-2 bg-[var(--secondary)] rounded-md border border-[var(--border)] font-mono font-bold">
                          #2,318 (Confirmed)
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-[var(--card)] p-5 rounded-xl border border-[var(--border)] flex flex-col justify-between">
                    <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase">
                      Cohort Distribution
                    </span>
                    <div className="my-4 space-y-2.5 text-xs">
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span>Engineering Track</span>
                          <span className="font-mono font-bold">1,480</span>
                        </div>
                        <div className="w-full bg-[var(--secondary)] h-2 rounded-full overflow-hidden">
                          <div className="bg-[var(--primary)] h-full w-[64%]" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span>Computer Science</span>
                          <span className="font-mono font-bold">620</span>
                        </div>
                        <div className="w-full bg-[var(--secondary)] h-2 rounded-full overflow-hidden">
                          <div className="bg-[var(--accent)] h-full w-[27%]" />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] mb-1">
                          <span>External Guests</span>
                          <span className="font-mono font-bold">218</span>
                        </div>
                        <div className="w-full bg-[var(--secondary)] h-2 rounded-full overflow-hidden">
                          <div className="bg-[var(--chart-3)] h-full w-[9%]" />
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      Instant payment verification via UPI / Razorpay / Stripe
                    </span>
                  </div>
                </div>
              )}

              {/* STAGE 1: CHECK-IN & SYSTEM VERIFY */}
              {activeStage === 1 && (
                <div className="animate-in fade-in duration-300 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-[var(--foreground)]">Webcam Sensor</span>
                      <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                    </div>
                    <div className="h-24 rounded-lg bg-[var(--secondary)] flex items-center justify-center border border-dashed border-[var(--border)] text-xs text-[var(--muted-foreground)] relative overflow-hidden">
                      <div className="w-10 h-10 rounded-full border-2 border-[var(--success)] flex items-center justify-center text-[10px] font-mono font-bold text-[var(--success)]">
                        1 FACE
                      </div>
                    </div>
                    <span className="mt-3 text-[11px] text-[var(--muted-foreground)]">
                      Single candidate identified
                    </span>
                  </div>

                  <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-[var(--foreground)]">Fullscreen Lock</span>
                      <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                    </div>
                    <div className="h-24 rounded-lg bg-[var(--secondary)] flex flex-col items-center justify-center text-center p-2">
                      <Shield className="w-6 h-6 text-[var(--primary)] mb-1" />
                      <span className="text-[11px] font-semibold text-[var(--foreground)]">
                        Kiosk Boundary Active
                      </span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">1920 × 1080 resolution</span>
                    </div>
                    <span className="mt-3 text-[11px] text-[var(--muted-foreground)]">
                      Exits logged to review feed
                    </span>
                  </div>

                  <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-[var(--foreground)]">Microphone & Audio</span>
                      <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                    </div>
                    <div className="h-24 rounded-lg bg-[var(--secondary)] flex items-center justify-center gap-1">
                      {[40, 65, 30, 80, 50, 20, 60, 45].map((h, i) => (
                        <div
                          key={i}
                          style={{ height: `${h}%` }}
                          className="w-1.5 bg-[var(--primary)] rounded-full"
                        />
                      ))}
                    </div>
                    <span className="mt-3 text-[11px] text-[var(--muted-foreground)]">
                      Ambient baseline calibrated
                    </span>
                  </div>

                  <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-[var(--foreground)]">Ready State</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[color-mix(in_oklch,var(--success)_20%,var(--card))] text-[var(--success)]">
                        CLEARED
                      </span>
                    </div>
                    <div className="h-24 rounded-lg bg-[var(--secondary)] flex flex-col items-center justify-center p-2 text-center">
                      <span className="text-xs font-mono font-bold text-[var(--foreground)]">
                        Room 03 · Track A
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)] mt-1">
                        Token synced to server
                      </span>
                    </div>
                    <span className="mt-3 text-[11px] text-[var(--success)] font-medium">
                      ✓ Instant room entry allowed
                    </span>
                  </div>
                </div>
              )}

              {/* STAGE 2: LIVE ROOM & REAL-TIME LEADERBOARD */}
              {activeStage === 2 && (
                <div className="animate-in fade-in duration-300 grid grid-cols-1 md:grid-cols-12 gap-5">
                  <div className="md:col-span-7 bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
                    <div className="px-4 py-2.5 bg-[var(--secondary)]/60 border-b border-[var(--border)] flex items-center justify-between text-xs font-semibold">
                      <span>Live Contest Question 27 / 50</span>
                      <span className="text-[var(--primary)] font-mono">1.5 pts</span>
                    </div>
                    <div className="p-4">
                      <p className="text-sm font-semibold text-[var(--foreground)] mb-3 leading-snug">
                        Which balanced search tree maintains a height of at most 1.44 log₂(n + 2) through strict node balance factors?
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 hover:border-[var(--primary)] cursor-pointer transition-colors">
                          A. Red-Black Tree
                        </div>
                        <div className="p-2.5 rounded-lg border-2 border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))] font-semibold text-[var(--primary)] flex items-center justify-between">
                          <span>B. AVL Tree</span>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                        <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 hover:border-[var(--primary)] cursor-pointer transition-colors">
                          C. B+ Tree
                        </div>
                        <div className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/50 hover:border-[var(--primary)] cursor-pointer transition-colors">
                          D. Splay Tree
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
                        <span>Auto-saving response...</span>
                        <span className="font-mono text-[var(--success)] font-semibold">✓ 2,019 answers recorded</span>
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-5 bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
                    <div className="px-4 py-2.5 bg-[var(--secondary)]/60 border-b border-[var(--border)] flex items-center justify-between text-xs font-semibold">
                      <span>Live Leaderboard</span>
                      <span className="text-[10px] text-[var(--muted-foreground)] font-mono">Synced</span>
                    </div>
                    <div className="p-2 divide-y divide-[var(--border)]">
                      {SAMPLE_LEADERBOARD.slice(0, 3).map((item) => (
                        <div key={item.id} className="p-2 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 text-center font-mono font-bold text-[var(--muted-foreground)]">
                              0{item.rank}
                            </span>
                            <div className="w-7 h-7 rounded bg-[var(--primary)] text-[var(--primary-foreground)] text-[11px] font-bold flex items-center justify-center">
                              {item.avatar}
                            </div>
                            <div>
                              <div className="font-semibold text-[var(--foreground)]">{item.name}</div>
                              <div className="text-[10px] text-[var(--muted-foreground)]">{item.institution}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-sm text-[var(--foreground)]">{item.score}</div>
                            <div className="text-[9px] text-[var(--success)] font-mono">▲ rank up</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 3: INTEGRITY MONITOR */}
              {activeStage === 3 && (
                <div className="animate-in fade-in duration-300 grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-2 bg-[var(--card)] rounded-xl border border-[var(--border)] overflow-hidden">
                    <div className="px-4 py-2.5 bg-[var(--secondary)]/60 border-b border-[var(--border)] flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-[var(--primary)]" />
                        Live Proctoring Signals Feed
                      </span>
                      <span className="text-[11px] text-[var(--muted-foreground)]">Zero auto-disqualifications</span>
                    </div>

                    <div className="p-3 space-y-2">
                      {SAMPLE_PROCTOR_ALERTS.slice(0, 3).map((alert) => (
                        <div
                          key={alert.id}
                          className="p-3 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/40 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`w-2 h-2 rounded-full mt-1.5 ${alert.severity === 'critical'
                                  ? 'bg-[var(--destructive)]'
                                  : alert.severity === 'warning'
                                    ? 'bg-[var(--warning)]'
                                    : 'bg-[var(--success)]'
                                }`}
                            />
                            <div>
                              <div className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                                {alert.participantName}
                                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)]">
                                  {alert.timestamp}
                                </span>
                              </div>
                              <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                                {alert.details}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 cursor-pointer">
                              Review
                            </button>
                            <button className="px-2 py-1 text-[11px] font-medium rounded border border-[var(--border)] hover:bg-[var(--card)] text-[var(--muted-foreground)] cursor-pointer">
                              Dismiss
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[var(--card)] p-4 rounded-xl border border-[var(--border)] flex flex-col justify-between">
                    <div>
                      <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider block">
                        Integrity Summary
                      </span>
                      <div className="mt-3 space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-[var(--border)]">
                          <span className="text-[var(--muted-foreground)]">Clean Sessions</span>
                          <span className="font-mono font-bold text-[var(--success)]">2,101 (99.8%)</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[var(--border)]">
                          <span className="text-[var(--muted-foreground)]">Warnings Resolved</span>
                          <span className="font-mono font-bold text-[var(--foreground)]">69 flags</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-[var(--border)]">
                          <span className="text-[var(--muted-foreground)]">In Review Queue</span>
                          <span className="font-mono font-bold text-[var(--warning)]">2 candidates</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-[var(--muted-foreground)]">Auto-disqualified</span>
                          <span className="font-mono font-bold text-[var(--foreground)]">0 (Rule enforced)</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 p-2.5 bg-[var(--secondary)] rounded-lg text-[11px] text-[var(--muted-foreground)] leading-relaxed">
                      💡 Human-in-the-loop review ensures every competition result stands up to student appeals.
                    </div>
                  </div>
                </div>
              )}

              {/* STAGE 4: RESULTS & CERTIFICATE */}
              {activeStage === 4 && (
                <div className="animate-in fade-in duration-300 grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  <div className="md:col-span-5 space-y-3">
                    <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[color-mix(in_oklch,var(--success)_15%,var(--card))] text-[var(--success)] text-xs font-semibold border border-[color-mix(in_oklch,var(--success)_30%,var(--border))]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Results Locked & Published
                    </div>
                    <h4 className="text-xl font-bold text-[var(--foreground)] tracking-tight">
                      Results immediately convert to verified recognition.
                    </h4>
                    <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                      Every participant certificate is anchored to contest audit logs with an instantaneous cryptographic verification hash.
                    </p>
                    <div className="pt-2 flex items-center gap-3">
                      <div className="px-3 py-1.5 rounded-md bg-[var(--secondary)] border border-[var(--border)] text-xs font-mono">
                        Rank #7 of 2,318
                      </div>
                      <div className="px-3 py-1.5 rounded-md bg-[var(--secondary)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--primary)]">
                        QB-7F3K-9XLQ
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-7 bg-[var(--card)] p-5 rounded-xl border border-[var(--border)] shadow-md relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-[var(--accent)]/30 to-transparent pointer-events-none" />
                    <div className="flex justify-between items-start border-b border-[var(--border)] pb-3">
                      <div>
                        <div className="text-xs font-extrabold uppercase tracking-widest text-[var(--primary)]">
                          QuizBuzz Certified
                        </div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">Official Competition Credential</div>
                      </div>
                      <div className="w-9 h-9 rounded-full bg-[var(--accent)] text-[var(--accent-foreground)] font-extrabold text-[10px] flex items-center justify-center border border-[var(--border)]">
                        SEAL
                      </div>
                    </div>

                    <div className="py-4 text-center">
                      <span className="text-[10px] uppercase text-[var(--muted-foreground)] tracking-wider">
                        This certifies that
                      </span>
                      <div className="text-lg font-extrabold text-[var(--foreground)] mt-0.5">
                        Arjun Mehta
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)] mt-1">
                        Ranked <strong className="text-[var(--foreground)]">7th</strong> out of 2,318 participants in{' '}
                        <span className="text-[var(--foreground)] font-semibold">
                          National Aptitude Sprint 2026
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-end pt-3 border-t border-[var(--border)] text-[10px]">
                      <div>
                        <div className="text-[var(--muted-foreground)]">Tamper-Proof Verification</div>
                        <div className="font-mono font-bold text-[var(--foreground)] mt-0.5">
                          verify.quizbuzz.io/cert/QB-7F3K-9XLQ
                        </div>
                      </div>
                      <div className="w-10 h-10 bg-[var(--secondary)] rounded border border-[var(--border)] flex items-center justify-center font-mono font-bold text-[9px] text-[var(--muted-foreground)]">
                        QR
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Status Ticker */}
            <div className="px-4 py-2.5 bg-[var(--secondary)]/70 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--muted-foreground)] font-mono flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5 text-[var(--foreground)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
                  INFRASTRUCTURE ONLINE
                </span>
                <span>Latency: 18ms</span>
                <span>Sockets: 2,104 Connected</span>
              </div>
              <div className="flex items-center gap-3">
                <span>Stage: {stages[activeStage].label}</span>
                <span>State: AUTO_PERSISTED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}