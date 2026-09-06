'use client';

import { useState } from 'react';
import { Zap, Activity, Cpu, Server, CheckCircle2 } from 'lucide-react';

export function ScaleSection() {
  const [scaleLevel, setScaleLevel] = useState<number>(3); // 0: 100, 1: 500, 2: 2,000, 3: 5,000+

  const tiers = [
    { users: '100', label: 'Department Classroom', sockets: '100 live', latency: '12ms', throughput: '150 req/s' },
    { users: '1,000', label: 'College-Wide Qualifier', sockets: '1,000 live', latency: '15ms', throughput: '1,400 req/s' },
    { users: '2,500', label: 'State-Level Hackathon', sockets: '2,500 live', latency: '16ms', throughput: '3,800 req/s' },
    { users: '5,000+', label: 'National Olympiad Sprint', sockets: '5,000+ live', latency: '18ms', throughput: '7,500 req/s' },
  ];

  const currentTier = tiers[scaleLevel];

  return (
    <section className="py-20 bg-[var(--background)] border-b border-[var(--border)] relative" id="scale">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-4">
            <Zap className="w-3.5 h-3.5" />
            Zero-Lag Scalability
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
            Built for the moment everyone clicks "Start".
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            From a 20-person seminar to 5,000+ concurrent competitors in the same second —<br />
            QuizBuzz balances load across edge nodes so the leaderboard never lags.
          </p>
        </div>

        {/* Interactive Concurrency Slider Card */}
        <div className="max-w-4xl mx-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 sm:p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border)]">
            <div>
              <span className="text-xs text-[var(--muted-foreground)] uppercase font-semibold">
                Simulate Concurrent Contest Room Load
              </span>
              <div className="text-3xl font-extrabold text-[var(--foreground)] font-mono mt-0.5">
                {currentTier.users} Participants
              </div>
              <span className="text-xs font-semibold text-[var(--primary)]">
                Format: {currentTier.label}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--success)] animate-pulse" />
              <span className="text-xs font-mono font-bold text-[var(--success)]">
                HEALTH: OPTIMAL (100%)
              </span>
            </div>
          </div>

          {/* Interactive Range Slider */}
          <div className="my-8">
            <div className="flex justify-between text-xs font-bold text-[var(--muted-foreground)] mb-2 font-mono">
              <span>100 Users</span>
              <span>1,000 Users</span>
              <span>2,500 Users</span>
              <span>5,000+ Users</span>
            </div>
            <input
              type="range"
              min="0"
              max="3"
              step="1"
              value={scaleLevel}
              onChange={(e) => setScaleLevel(parseInt(e.target.value))}
              aria-label="Concurrency Scale Level"
              className="w-full accent-[var(--primary)] h-2 bg-[var(--secondary)] rounded-lg cursor-pointer"
            />
          </div>

          {/* Real-Time Infrastructure Response Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-[var(--secondary)]/40 rounded-xl border border-[var(--border)]">
              <span className="text-[11px] text-[var(--muted-foreground)] block">WebSocket Latency</span>
              <span className="font-mono text-xl font-bold text-[var(--primary)] mt-1 block">
                {currentTier.latency}
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)]">Global Edge Delivery</span>
            </div>

            <div className="p-4 bg-[var(--secondary)]/40 rounded-xl border border-[var(--border)]">
              <span className="text-[11px] text-[var(--muted-foreground)] block">Active TCP Sockets</span>
              <span className="font-mono text-xl font-bold text-[var(--foreground)] mt-1 block">
                {currentTier.sockets}
              </span>
              <span className="text-[10px] text-[var(--success)]">0% Packet Loss</span>
            </div>

            <div className="p-4 bg-[var(--secondary)]/40 rounded-xl border border-[var(--border)]">
              <span className="text-[11px] text-[var(--muted-foreground)] block">Submission Throughput</span>
              <span className="font-mono text-xl font-bold text-[var(--foreground)] mt-1 block">
                {currentTier.throughput}
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)]">Auto-scaling workers</span>
            </div>

            <div className="p-4 bg-[var(--secondary)]/40 rounded-xl border border-[var(--border)]">
              <span className="text-[11px] text-[var(--muted-foreground)] block">Leaderboard Recalc</span>
              <span className="font-mono text-xl font-bold text-[var(--success)] mt-1 block">
                &lt; 50ms
              </span>
              <span className="text-[10px] text-[var(--muted-foreground)]">In-memory sorting</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}