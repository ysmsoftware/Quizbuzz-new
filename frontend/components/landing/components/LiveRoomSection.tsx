'use client';

import { useState, useEffect } from 'react';
import { Radio, Users, CheckCircle, AlertTriangle, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { SAMPLE_LEADERBOARD, SAMPLE_PROCTOR_ALERTS } from '../data/mockData';
import { LeaderboardEntry, ProctorAlert } from '../types';

export function LiveRoomSection() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(SAMPLE_LEADERBOARD);
  const [alerts, setAlerts] = useState<ProctorAlert[]>(SAMPLE_PROCTOR_ALERTS);
  const [submittedCount, setSubmittedCount] = useState(68421);
  const [timerSeconds, setTimerSeconds] = useState(12 * 60 + 47);

  // Countdown timer
  useEffect(() => {
    const t = setInterval(() => {
      setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 15 * 60));
      // Increment submitted count slowly
      if (Math.random() > 0.4) {
        setSubmittedCount((prev) => prev + Math.floor(Math.random() * 3) + 1);
      }
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Real-time rank changes simulation
  useEffect(() => {
    const shuffleInterval = setInterval(() => {
      setLeaderboard((prev) => {
        if (prev.length < 4) return prev;
        const copy = [...prev];
        // Swap rank 2 and 3 with delta markers
        const idx1 = 1;
        const idx2 = 2;
        const temp = { ...copy[idx1] };
        copy[idx1] = {
          ...copy[idx2],
          rank: 2,
          delta: 'up',
          score: copy[idx2].score + 15,
        };
        copy[idx2] = {
          ...temp,
          rank: 3,
          delta: 'down',
        };
        return copy;
      });

      // Clear delta after 2.5s
      setTimeout(() => {
        setLeaderboard((curr) =>
          curr.map((row) => ({ ...row, delta: 'flat' }))
        );
      }, 2500);
    }, 5500);

    return () => clearInterval(shuffleInterval);
  }, []);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <section className="py-20 bg-[var(--secondary)]/30 border-b border-[var(--border)] relative" id="monitoring">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-4">
            <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            While The Room Is Live
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
            See the competition as it happens.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            Rank movement, answer velocity, and integrity flags — combined into<br />
            a single, unified supervision cockpit.
          </p>
        </div>

        {/* Live Cockpit Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Live Leaderboard */}
          <div className="lg:col-span-7 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden">
            <div className="p-4 bg-[var(--secondary)]/60 border-b border-[var(--border)] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--foreground)] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                  Live Official Standings
                </h3>
                <span className="text-[11px] text-[var(--muted-foreground)] font-mono">
                  Round 3 of 4 · Auto-updating
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="text-[10px] text-[var(--muted-foreground)] block">Clock Remaining</span>
                  <span className="text-base font-mono font-extrabold text-[var(--foreground)]">
                    {formatTimer(timerSeconds)}
                  </span>
                </div>
              </div>
            </div>

            {/* Board Rows */}
            <div className="p-3 divide-y divide-[var(--border)]">
              {leaderboard.slice(0, 5).map((row) => (
                <div
                  key={row.id}
                  className="p-3 flex items-center justify-between gap-3 hover:bg-[var(--secondary)]/30 rounded-lg transition-all"
                >
                  <div className="flex items-center gap-3">
                    {/* Rank delta */}
                    <div className="w-4 text-center">
                      {row.delta === 'up' && (
                        <ArrowUp className="w-3.5 h-3.5 text-[var(--success)] font-bold animate-bounce" />
                      )}
                      {row.delta === 'down' && (
                        <ArrowDown className="w-3.5 h-3.5 text-[var(--destructive)] font-bold" />
                      )}
                      {row.delta === 'flat' && (
                        <Minus className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
                      )}
                    </div>

                    <span className="w-6 font-mono font-bold text-sm text-[var(--muted-foreground)]">
                      #{row.rank}
                    </span>

                    <div className="w-8 h-8 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center font-bold text-xs shadow-xs">
                      {row.avatar}
                    </div>

                    <div>
                      <div className="font-bold text-xs sm:text-sm text-[var(--foreground)]">
                        {row.name}
                      </div>
                      <div className="text-[11px] text-[var(--muted-foreground)]">
                        {row.institution} · <span className="font-mono">{row.department}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-sm sm:text-base font-extrabold text-[var(--foreground)]">
                      {row.score}
                    </div>
                    <span className="text-[10px] text-[var(--muted-foreground)] font-mono">
                      pts
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-4 py-3 bg-[var(--secondary)]/40 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--muted-foreground)]">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                2,104 test-takers active in room
              </span>
              <span className="font-mono text-[11px]">Tie-break: Accuracy then submission timestamp</span>
            </div>
          </div>

          {/* Right Column: Live Telemetry & Alerts Feed */}
          <div className="lg:col-span-5 space-y-6">
            {/* Real-time counters card */}
            <div className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-lg">
              <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider block mb-3">
                Room Telemetry
              </span>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-3 bg-[var(--secondary)]/40 rounded-xl border border-[var(--border)]">
                  <span className="text-[11px] text-[var(--muted-foreground)] block">Active Concurrency</span>
                  <span className="font-mono text-xl font-bold text-[var(--primary)] mt-0.5 block">
                    2,104 / 2,318
                  </span>
                  <span className="text-[10px] text-[var(--success)] font-medium">91% in session</span>
                </div>

                <div className="p-3 bg-[var(--secondary)]/40 rounded-xl border border-[var(--border)]">
                  <span className="text-[11px] text-[var(--muted-foreground)] block">Answers Logged</span>
                  <span className="font-mono text-xl font-bold text-[var(--foreground)] mt-0.5 block">
                    {submittedCount.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-[var(--muted-foreground)]">50 questions total</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-[var(--secondary)]/30 border border-[var(--border)] flex items-center justify-between text-xs">
                <span className="text-[var(--muted-foreground)]">Integrity State:</span>
                <span className="font-mono font-bold text-[var(--success)] flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5" />
                  2,101 / 2,104 Verified Normal
                </span>
              </div>
            </div>

            {/* Live Proctoring Signals Feed */}
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-lg overflow-hidden">
              <div className="p-3.5 bg-[var(--secondary)]/60 border-b border-[var(--border)] flex items-center justify-between text-xs">
                <span className="font-bold text-[var(--foreground)] flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />
                  Live Review Stream
                </span>
                <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                  3 flagged items
                </span>
              </div>

              <div className="p-3 space-y-2">
                {alerts.map((al) => (
                  <div
                    key={al.id}
                    className="p-2.5 rounded-lg border border-[var(--border)] bg-[var(--secondary)]/20 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-[var(--foreground)]">
                        {al.participantName}
                      </div>
                      <div className="text-[11px] text-[var(--muted-foreground)]">
                        {al.details}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-[var(--muted-foreground)] px-2 py-0.5 rounded bg-[var(--card)] border border-[var(--border)]">
                      {al.timestamp}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}