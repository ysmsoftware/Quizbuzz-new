'use client';

import { useState } from 'react';
import {
  Shield,
  Clock,
  Eye,
  Maximize2,
  Users2,
  UserX,
  Copy,
  Gauge,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  FileCheck2
} from 'lucide-react';

export function ProctoringSection() {
  const [selectedSop, setSelectedSop] = useState<number | null>(null);

  const sopCards = [
    {
      title: 'Fullscreen Exit',
      detects: 'Participant minimizes the window, triggers split-screen or exits kiosk fullscreen mode.',
      response: 'Candidate is re-prompted instantly; second exit timestamped with snapshot and logged to organizer review queue.',
      severity: 'warning',
      icon: Maximize2,
      sla: 'Logged < 0.8s',
    },
    {
      title: 'Tab / Window Switch',
      detects: 'Browser tab loses focus or external application (chat, search, IDE) gains active foreground.',
      response: 'Duration and timestamp recorded. Accumulation of 3+ switches auto-escalates for faculty sign-off.',
      severity: 'warning',
      icon: Eye,
      sla: 'Logged < 0.5s',
    },
    {
      title: 'Multiple Faces in Frame',
      detects: 'Webcam vision model detects secondary individual entering candidate workspace or whispering.',
      response: 'Flagged with triggering frame thumbnail attached. Candidate is not interrupted mid-thought; queued for review.',
      severity: 'critical',
      icon: Users2,
      sla: 'Frame attached',
    },
    {
      title: 'No Face Detected',
      detects: 'Webcam frame shows empty chair or prolonged off-screen gaze for over 8 consecutive seconds.',
      response: 'Gentle on-screen reminder appears. Continued absence logged with camera stream audit log.',
      severity: 'warning',
      icon: UserX,
      sla: '8s threshold',
    },
    {
      title: 'Copy, Paste & Shortcut Block',
      detects: 'Attempts to copy question text to clipboard, open DevTools console, or invoke context menu.',
      response: 'Clipboard operation intercepted and suppressed; question ID tagged in the contest audit log.',
      severity: 'info',
      icon: Copy,
      sla: 'Zero leakage',
    },
    {
      title: 'Answer-Time Anomaly',
      detects: 'Complex multi-step numerical calculation answered in under 2.1 seconds (faster than reading floor).',
      response: 'Logged as a statistical outlier for organizer comparison against candidate cohort average.',
      severity: 'info',
      icon: Gauge,
      sla: 'Statistical flag',
    },
    {
      title: 'Session Disconnect & Recovery',
      detects: 'Sudden WiFi drop, system reboot, or accidental closed browser tab during competition.',
      response: 'Answers saved to edge database up to the second; candidate resumes immediately on re-login without score penalty.',
      severity: 'success',
      icon: WifiOff,
      sla: 'Full state restore',
    },
  ];

  return (
    <section className="py-20 bg-[var(--background)] border-b border-[var(--border)] relative" id="proctoring">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-4">
            <Shield className="w-3.5 h-3.5" />
            Integrity Without Interruption
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
            Make every result defensible.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            Monitor competition integrity while participants compete, with<br />
            every violation surfaced in context — never auto-disqualified.
          </p>
        </div>

        {/* SLA Callouts Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[var(--primary)]">
              &lt; 1s
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1 font-medium">
              Time for a candidate signal flag to reach the organizer dashboard
            </div>
          </div>

          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[var(--foreground)]">
              90 Days
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1 font-medium">
              Tamper-proof evidence and webcam snapshot retention for appeal reviews
            </div>
          </div>

          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[var(--success)]">
              100%
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1 font-medium">
              Flags queued for human-in-the-loop decision — zero algorithmic disqualification
            </div>
          </div>
        </div>

        {/* SOP Standard Operating Procedure Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sopCards.map((sop, idx) => {
            const Icon = sop.icon;
            const isSelected = selectedSop === idx;
            return (
              <div
                key={idx}
                onClick={() => setSelectedSop(isSelected ? null : idx)}
                className={`p-5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-[var(--primary)] bg-[var(--card)] ring-2 ring-[var(--primary)]/20 shadow-md'
                    : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--primary)]/50 hover:shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          sop.severity === 'critical'
                            ? 'bg-red-500'
                            : sop.severity === 'warning'
                            ? 'bg-amber-500'
                            : sop.severity === 'success'
                            ? 'bg-green-500'
                            : 'bg-sky-500'
                        }`}
                      />
                      <h4 className="text-sm font-bold text-[var(--foreground)]">{sop.title}</h4>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[var(--secondary)] text-[var(--muted-foreground)]">
                      {sop.sla}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--muted-foreground)] leading-relaxed mb-3">
                    <strong className="text-[var(--foreground)] font-semibold">Detection: </strong>
                    {sop.detects}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border)] text-xs leading-relaxed">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--primary)] block mb-1">
                    Defensible Response
                  </span>
                  <p className="text-[11px] text-[var(--foreground)]">{sop.response}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Reassurance Footer */}
        <div className="mt-10 p-5 rounded-xl bg-[var(--secondary)]/40 border border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2.5 text-[var(--foreground)]">
            <FileCheck2 className="w-5 h-5 text-[var(--primary)] shrink-0" />
            <span>
              <strong>Students respect clear rules:</strong> Candidates accept the proctoring charter before entering, knowing all flags are reviewed by faculty organizers rather than a black-box AI.
            </span>
          </div>
          <span className="font-mono text-[11px] text-[var(--muted-foreground)] shrink-0">
            Compliant with University Exam Cell Guidelines
          </span>
        </div>
      </div>
    </section>
  );
}