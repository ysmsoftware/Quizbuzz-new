'use client';

import { useState } from 'react';
import { BarChart3, Download, FileText, CheckCircle2, TrendingUp } from 'lucide-react';

export function AnalyticsSection() {
  const [downloading, setDownloading] = useState<string | null>(null);

  const collegeCohorts = [
    { name: 'MIT Pune (ECE & CS)', avgScore: '82.4%', students: 640, completion: '98.5%' },
    { name: 'COEP Tech (Computer Engineering)', avgScore: '78.8%', students: 512, completion: '97.2%' },
    { name: 'VJTI Mumbai (Information Tech)', avgScore: '76.1%', students: 480, completion: '96.8%' },
    { name: 'Ashcroft Institute of Technology', avgScore: '74.5%', students: 390, completion: '95.1%' },
    { name: 'Sable Ridge & External Chapters', avgScore: '71.2%', students: 296, completion: '94.0%' },
  ];

  const handleExport = (fileType: string) => {
    setDownloading(fileType);
    setTimeout(() => setDownloading(null), 1500);
  };

  return (
    <section className="py-20 bg-[var(--background)] border-b border-[var(--border)] relative" id="analytics">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-4">
            <BarChart3 className="w-3.5 h-3.5" />
            After The Clock Stops
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
            Know what happened when the contest ends.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            Turn competition activity into defensible institutional results —<br />
            cohort performance, topic mastery, and export-ready reports.
          </p>
        </div>

        {/* Top Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
            <span className="text-xs text-[var(--muted-foreground)] font-semibold uppercase">Total Participants</span>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-[var(--foreground)] mt-1">2,318</div>
            <span className="text-xs text-[var(--muted-foreground)]">Across 14 institutions</span>
          </div>

          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
            <span className="text-xs text-[var(--muted-foreground)] font-semibold uppercase">Completion Rate</span>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-[var(--success)] mt-1">97.2%</div>
            <span className="text-xs text-[var(--muted-foreground)]">2,253 completed all 50 Qs</span>
          </div>

          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
            <span className="text-xs text-[var(--muted-foreground)] font-semibold uppercase">Average Score</span>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-[var(--primary)] mt-1">72.4%</div>
            <span className="text-xs text-[var(--muted-foreground)]">Median time: 38m 21s</span>
          </div>

          <div className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-xs">
            <span className="text-xs text-[var(--muted-foreground)] font-semibold uppercase">Integrity Verdict</span>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-[var(--foreground)] mt-1">100%</div>
            <span className="text-xs text-[var(--muted-foreground)]">All appeals resolved</span>
          </div>
        </div>

        {/* Cohort Performance Breakdown Table */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-xl overflow-hidden mb-8">
          <div className="p-5 bg-[var(--secondary)]/60 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-sm text-[var(--foreground)]">
                Institution & Cohort Benchmark Comparison
              </h3>
              <p className="text-xs text-[var(--muted-foreground)]">
                Automatically categorized via participant student registration data
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleExport('csv')}
                className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-semibold hover:bg-[var(--secondary)] flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                {downloading === 'csv' ? 'Exporting...' : 'Export CSV'}
              </button>
              <button
                onClick={() => handleExport('pdf')}
                className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                {downloading === 'pdf' ? 'Generating...' : 'Dean Summary PDF'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[var(--secondary)]/30 text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5">Institution Cohort</th>
                  <th className="p-3.5">Participants</th>
                  <th className="p-3.5">Completion</th>
                  <th className="p-3.5">Average Score</th>
                  <th className="p-3.5">Relative Standing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {collegeCohorts.map((col, idx) => (
                  <tr key={idx} className="hover:bg-[var(--secondary)]/20">
                    <td className="p-3.5 font-bold text-[var(--foreground)]">{col.name}</td>
                    <td className="p-3.5 font-mono text-[var(--muted-foreground)]">{col.students} students</td>
                    <td className="p-3.5 font-mono text-[var(--success)] font-semibold">{col.completion}</td>
                    <td className="p-3.5 font-mono font-bold text-sm text-[var(--foreground)]">{col.avgScore}</td>
                    <td className="p-3.5">
                      <div className="w-36 bg-[var(--secondary)] h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-[var(--primary)] h-full"
                          style={{ width: col.avgScore }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {downloading && (
          <div className="p-3 bg-[color-mix(in_oklch,var(--success)_15%,var(--card))] border border-[var(--success)] rounded-xl text-center text-xs font-semibold text-[var(--success)] animate-pulse">
            ✓ Exporting {downloading.toUpperCase()} package with complete contest hashes and student audit data...
          </div>
        )}
      </div>
    </section>
  );
}