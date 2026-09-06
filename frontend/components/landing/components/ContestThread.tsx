'use client';

import { useState } from 'react';
import {
  UserPlus,
  Camera,
  CheckCircle2,
  Terminal,
  Activity,
  Trophy,
  Award,
  ChevronRight,
  ShieldCheck,
  Check
} from 'lucide-react';

export function ContestThread() {
  const [activeStep, setActiveStep] = useState<number>(2); // Default to COMPETE
  const [selectedOption, setSelectedOption] = useState<number>(1);
  const [registered, setRegistered] = useState(false);

  const steps = [
    {
      step: '01',
      title: 'REGISTER',
      subtitle: 'Contest registration',
      desc: 'Seamless sign-up with institution routing, track selection, and fee handling in one step.',
      icon: UserPlus,
    },
    {
      step: '02',
      title: 'VERIFY',
      subtitle: 'System check',
      desc: 'Automated camera, microphone, browser and fullscreen lockdown check before start time.',
      icon: Camera,
    },
    {
      step: '03',
      title: 'COMPETE',
      subtitle: 'Contest room',
      desc: 'Timed questions with answer auto-save, anti-copy lock, and resilient session recovery.',
      icon: Terminal,
    },
    {
      step: '04',
      title: 'MONITOR',
      subtitle: 'Live integrity',
      desc: 'Real-time telemetry detects tab switches, multiple faces, and anomalies without auto-failing.',
      icon: Activity,
    },
    {
      step: '05',
      title: 'RANK',
      subtitle: 'Live standings',
      desc: 'Sub-second rank updates with tie-breaker rules, institution grouping, and locked audit logs.',
      icon: Trophy,
    },
    {
      step: '06',
      title: 'CERTIFY',
      subtitle: 'Instant recognition',
      desc: 'Authentic certificates generated immediately with verifiable public cryptographic QR codes.',
      icon: Award,
    },
  ];

  return (
    <section className="py-20 bg-[var(--secondary)]/40 border-b border-[var(--border)] relative" id="how-it-works">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
            The Contest Thread
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
            From registration to recognition.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            Every part of the competition stays connected — participants register once,<br />
            and results flow naturally through to certification.
          </p>
        </div>

        {/* Thread Stages Horizontal Navigation for Desktop / Scrollable */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-10">
          {steps.map((item, index) => {
            const Icon = item.icon;
            const isActive = activeStep === index;
            return (
              <button
                key={index}
                onClick={() => setActiveStep(index)}
                className={`text-left p-3.5 rounded-xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
                  isActive
                    ? 'border-[var(--primary)] bg-[var(--card)] shadow-md ring-1 ring-[var(--primary)]'
                    : 'border-[var(--border)] bg-[var(--card)]/60 hover:bg-[var(--card)] text-[var(--muted-foreground)]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs font-mono font-bold ${
                        isActive ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'
                      }`}
                    >
                      {item.step}
                    </span>
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'
                      }`}
                    />
                  </div>
                  <h4
                    className={`text-xs font-bold uppercase tracking-wider ${
                      isActive ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'
                    }`}
                  >
                    {item.title}
                  </h4>
                  <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 truncate">
                    {item.subtitle}
                  </p>
                </div>

                {isActive && (
                  <div className="w-full bg-[var(--primary)] h-0.5 rounded-full mt-3" />
                )}
              </button>
            );
          })}
        </div>

        {/* Dynamic Interactive Stage Deep-Dive Showcase */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Step Description & Explanatory Narrative */}
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[var(--secondary)] text-[var(--primary)] text-xs font-mono font-bold">
                STAGE {steps[activeStep].step} · {steps[activeStep].title}
              </div>

              <h3 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">
                {steps[activeStep].subtitle}
              </h3>

              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                {steps[activeStep].desc}
              </p>

              <div className="pt-2 border-t border-[var(--border)] text-xs text-[var(--muted-foreground)] space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                  <span>Integrated directly into the live contest database</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                  <span>Real-time state transitions without page refresh</span>
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
                  className="px-3 py-1.5 rounded-lg border border-[var(--border)] text-xs font-semibold disabled:opacity-40 cursor-pointer hover:bg-[var(--secondary)]"
                >
                  ← Previous Stage
                </button>
                <button
                  disabled={activeStep === 5}
                  onClick={() => setActiveStep((prev) => Math.min(5, prev + 1))}
                  className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold disabled:opacity-40 cursor-pointer hover:opacity-90 flex items-center gap-1"
                >
                  Next Stage →
                </button>
              </div>
            </div>

            {/* Interactive Step Miniature Mockup */}
            <div className="lg:col-span-7 bg-[var(--background)] p-5 sm:p-6 rounded-xl border border-[var(--border)]">
              {/* MINI 01: REGISTER */}
              {activeStep === 0 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                    <span className="text-xs font-bold text-[var(--foreground)]">
                      Participant Registration Gateway
                    </span>
                    <span className="text-[11px] font-mono text-[var(--success)]">● 2,318 Registered</span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <label className="text-[11px] text-[var(--muted-foreground)]">Full Name</label>
                      <input
                        type="text"
                        readOnly
                        value="Arjun Mehta"
                        aria-label="Participant Name"
                        className="w-full mt-1 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-md text-[var(--foreground)]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] text-[var(--muted-foreground)]">Institution</label>
                        <input
                          type="text"
                          readOnly
                          value="Meridian State University"
                          aria-label="Institution"
                          className="w-full mt-1 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-md text-[var(--foreground)]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-[var(--muted-foreground)]">Cohort Track</label>
                        <select
                          disabled
                          aria-label="Cohort Track"
                          className="w-full mt-1 px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-md text-[var(--foreground)]"
                        >
                          <option>Aptitude & Logic Track</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setRegistered(!registered)}
                    className="w-full py-2.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-xs font-semibold hover:opacity-90 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {registered ? '✓ Registration Verified & Slot Locked' : 'Simulate Confirm Registration →'}
                  </button>
                </div>
              )}

              {/* MINI 02: VERIFY */}
              {activeStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                    <span className="text-xs font-bold text-[var(--foreground)]">
                      System Check & Pre-Flight Checklist
                    </span>
                    <span className="text-[11px] text-[var(--primary)] font-semibold">4 / 4 Passed</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                        <span>Camera Feed</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--success)] font-bold">ACTIVE</span>
                    </div>

                    <div className="p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                        <span>Microphone</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--success)] font-bold">NORMAL</span>
                    </div>

                    <div className="p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                        <span>Browser Compatibility</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--success)] font-bold">V8 ENGINE</span>
                    </div>

                    <div className="p-3 bg-[var(--card)] border border-[var(--border)] rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />
                        <span>Fullscreen Lockdown</span>
                      </div>
                      <span className="text-[10px] font-mono text-[var(--success)] font-bold">ENFORCED</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-[color-mix(in_oklch,var(--success)_15%,var(--card))] border border-[color-mix(in_oklch,var(--success)_30%,var(--border))] text-xs text-[var(--success)] flex items-center gap-2 font-medium">
                    <ShieldCheck className="w-4 h-4" />
                    System checks cleared. Participant is authenticated and isolated for Round 3.
                  </div>
                </div>
              )}

              {/* MINI 03: COMPETE */}
              {activeStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)] text-xs">
                    <span className="font-bold text-[var(--foreground)]">Question 27 / 50</span>
                    <span className="font-mono text-[var(--primary)] font-bold">⏱ 00:31:42</span>
                  </div>

                  <div className="p-3 bg-[var(--card)] rounded-lg border border-[var(--border)]">
                    <p className="text-xs font-semibold text-[var(--foreground)] mb-3 leading-snug">
                      Which abstract data structure adheres strictly to the First-In, First-Out (FIFO) principle?
                    </p>

                    <div className="space-y-2 text-xs">
                      {['Stack', 'Queue', 'Hash Map', 'Binary Heap'].map((opt, i) => (
                        <div
                          key={i}
                          onClick={() => setSelectedOption(i)}
                          className={`p-2.5 rounded-md border text-xs flex items-center justify-between cursor-pointer transition-all ${
                            selectedOption === i
                              ? 'border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_10%,var(--card))] text-[var(--primary)] font-semibold'
                              : 'border-[var(--border)] bg-[var(--secondary)]/40 hover:bg-[var(--secondary)] text-[var(--foreground)]'
                          }`}
                        >
                          <span>{opt}</span>
                          {selectedOption === i && <Check className="w-3.5 h-3.5" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
                    <span>Answers synced securely across edge nodes</span>
                    <span className="text-[var(--success)] font-mono font-medium">Auto-saved 2s ago</span>
                  </div>
                </div>
              )}

              {/* MINI 04: MONITOR */}
              {activeStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)] text-xs">
                    <span className="font-bold text-[var(--foreground)]">Proctoring Telemetry</span>
                    <span className="text-[var(--warning)] font-mono font-bold">3 Pending Flags</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[var(--foreground)]">Aarav Sharma (MIT Pune)</div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">Fullscreen exited, returned in 3s</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[var(--secondary)] font-mono text-[var(--success)] font-bold">
                        RESOLVED
                      </span>
                    </div>

                    <div className="p-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[var(--foreground)]">Participant #1827</div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">Multiple faces detected in frame</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-600 font-mono font-bold">
                        QUEUED REVIEW
                      </span>
                    </div>

                    <div className="p-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[var(--foreground)]">Daniel Osei</div>
                        <div className="text-[10px] text-[var(--muted-foreground)]">Tab switch logged (1.8s)</div>
                      </div>
                      <span className="px-2 py-0.5 rounded text-[10px] bg-[color-mix(in_oklch,var(--warning)_20%,var(--card))] text-[var(--accent-foreground)] font-mono font-bold">
                        WARNING 1/3
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] text-[var(--muted-foreground)] block">
                    Zero automated penalization. Organizers review full context and webcam snaps before taking action.
                  </span>
                </div>
              )}

              {/* MINI 05: RANK */}
              {activeStep === 4 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)] text-xs">
                    <span className="font-bold text-[var(--foreground)]">Official Live Leaderboard</span>
                    <span className="text-[var(--primary)] font-mono font-bold">Top 3 of 2,318</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="p-3 bg-[var(--card)] border-2 border-[var(--primary)] rounded-lg flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-3">
                        <span className="w-5 font-mono font-bold text-amber-500 text-sm">#1</span>
                        <div>
                          <div className="font-bold text-[var(--foreground)]">Aarav Sharma</div>
                          <div className="text-[10px] text-[var(--muted-foreground)]">MIT Pune · 34m 12s</div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-sm text-[var(--primary)]">982 pts</span>
                    </div>

                    <div className="p-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-5 font-mono font-bold text-[var(--muted-foreground)]">#2</span>
                        <div>
                          <div className="font-semibold text-[var(--foreground)]">Priya Kapoor</div>
                          <div className="text-[10px] text-[var(--muted-foreground)]">COEP Tech · 36m 40s</div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-sm text-[var(--foreground)]">974 pts</span>
                    </div>

                    <div className="p-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-5 font-mono font-bold text-[var(--muted-foreground)]">#3</span>
                        <div>
                          <div className="font-semibold text-[var(--foreground)]">Rohan Mehta</div>
                          <div className="text-[10px] text-[var(--muted-foreground)]">VJTI Mumbai · 39m 05s</div>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-sm text-[var(--foreground)]">969 pts</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] font-mono">
                    <span>Leaderboard lock: When clock reaches 00:00</span>
                    <span className="text-[var(--primary)]">Audit Log #NAS-2026-R3</span>
                  </div>
                </div>
              )}

              {/* MINI 06: CERTIFY */}
              {activeStep === 5 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="p-4 bg-[var(--card)] rounded-xl border border-[var(--border)] text-center relative overflow-hidden">
                    <div className="text-[10px] font-bold text-[var(--primary)] uppercase tracking-widest">
                      QuizBuzz Credential
                    </div>
                    <div className="text-sm font-extrabold text-[var(--foreground)] mt-1">
                      CERTIFICATE OF ACHIEVEMENT
                    </div>
                    <p className="text-[11px] text-[var(--muted-foreground)] mt-1">
                      Presented to <strong className="text-[var(--foreground)]">Arjun Mehta</strong>
                    </p>
                    <p className="text-[10px] text-[var(--muted-foreground)] mt-0.5">
                      Ranked <span className="font-bold text-[var(--foreground)]">7th</span> in National Aptitude Sprint 2026
                    </p>
                    <div className="mt-3 pt-2 border-t border-[var(--border)] flex items-center justify-between text-[10px] text-[var(--muted-foreground)] font-mono">
                      <span>Hash: QB-7F3K-9XLQ</span>
                      <span className="text-[var(--success)] font-semibold">✓ Cryptographically Verified</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button className="w-full py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-xs font-semibold hover:opacity-90 transition-all cursor-pointer">
                      Download Verified PDF
                    </button>
                    <button className="px-3 py-2 border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] rounded-lg text-xs font-semibold hover:bg-[var(--secondary)] transition-all cursor-pointer">
                      Verify Credential
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}