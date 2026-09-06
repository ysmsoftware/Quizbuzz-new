'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  HelpCircle,
  Users,
  Radio,
  ShieldAlert,
  Award,
  BarChart,
  Search,
  Plus,
  ArrowUpRight,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { SAMPLE_PARTICIPANTS, SAMPLE_QUESTIONS, SAMPLE_PROCTOR_ALERTS } from '../data/mockData';

export function OrganizerCommandCenter() {
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'participants' | 'live' | 'proctoring' | 'results'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'verified' | 'flagged'>('all');

  const filteredParticipants = SAMPLE_PARTICIPANTS.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.institution.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.department.toLowerCase().includes(searchQuery.toLowerCase());
    if (selectedFilter === 'all') return matchesSearch;
    if (selectedFilter === 'verified') return matchesSearch && p.status === 'verified';
    if (selectedFilter === 'flagged') return matchesSearch && (p.status === 'flagged' || p.flagsCount > 0);
    return matchesSearch;
  });

  return (
    <section className="py-20 bg-[var(--background)] border-b border-[var(--border)] relative" id="organizers">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-4">
            <LayoutDashboard className="w-3.5 h-3.5" />
            Organizer Command Center
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
            Run the room, not a spreadsheet.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            Build the competition, manage participants, and watch the room —<br />
            all without stitching together separate tools.
          </p>
        </div>

        {/* 1200-1400px wide Organizer Dashboard Frame */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl overflow-hidden">
          {/* Dashboard Header Bar */}
          <div className="px-5 py-3.5 bg-[var(--secondary)]/70 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center font-bold text-xs">
                QB
              </div>
              <div>
                <div className="font-bold text-sm text-[var(--foreground)] leading-none">
                  National Aptitude Sprint 2026
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5 font-mono">
                  Room #03 · Engineering Track · 5,000 Capacity
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[color-mix(in_oklch,var(--success)_15%,var(--card))] text-[var(--success)] border border-[color-mix(in_oklch,var(--success)_30%,var(--border))]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
                Live: Round 3
              </span>
              <button className="px-3 py-1 text-xs font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90 transition-all flex items-center gap-1 cursor-pointer">
                <ArrowUpRight className="w-3.5 h-3.5" />
                Live View
              </button>
            </div>
          </div>

          {/* Dashboard Layout: Sidebar + Main Area */}
          <div className="grid grid-cols-1 md:grid-cols-12 min-h-[540px]">
            {/* Sidebar Navigation */}
            <div className="md:col-span-3 border-r border-[var(--border)] bg-[var(--secondary)]/30 p-3 flex md:flex-col gap-1 overflow-x-auto">
              {[
                { id: 'overview', label: 'Overview', icon: LayoutDashboard },
                { id: 'questions', label: 'Question Bank', icon: HelpCircle },
                { id: 'participants', label: 'Participants (2,318)', icon: Users },
                { id: 'live', label: 'Live Room Watch', icon: Radio },
                { id: 'proctoring', label: 'Integrity Logs', icon: ShieldAlert },
                { id: 'results', label: 'Results & Analytics', icon: BarChart },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all text-left whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[var(--card)] text-[var(--primary)] shadow-xs border border-[var(--border)]'
                        : 'text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'}`} />
                    {tab.label}
                  </button>
                );
              })}

              <div className="mt-auto hidden md:block pt-4 border-t border-[var(--border)] text-[11px] text-[var(--muted-foreground)]">
                <div className="p-2.5 rounded-lg bg-[var(--card)] border border-[var(--border)]">
                  <span className="font-semibold text-[var(--foreground)] block">Proctor SLA</span>
                  90-day evidence logs backed by tamper-proof timestamps.
                </div>
              </div>
            </div>

            {/* Main Surface View */}
            <div className="md:col-span-9 p-5 md:p-6 bg-[var(--card)] flex flex-col justify-between">
              {/* TAB 1: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-[var(--secondary)]/40 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                        Registered
                      </span>
                      <div className="text-2xl font-mono font-bold text-[var(--foreground)] mt-1">2,318</div>
                      <span className="text-[10px] text-[var(--success)] font-medium">96% verified check-in</span>
                    </div>

                    <div className="p-3.5 bg-[var(--secondary)]/40 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                        Active In Room
                      </span>
                      <div className="text-2xl font-mono font-bold text-[var(--primary)] mt-1">2,104</div>
                      <span className="text-[10px] text-[var(--muted-foreground)]">Round 3 of 4</span>
                    </div>

                    <div className="p-3.5 bg-[var(--secondary)]/40 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                        Integrity Flags
                      </span>
                      <div className="text-2xl font-mono font-bold text-[var(--warning)] mt-1">3</div>
                      <span className="text-[10px] text-[var(--muted-foreground)]">In review queue</span>
                    </div>

                    <div className="p-3.5 bg-[var(--secondary)]/40 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--muted-foreground)] uppercase tracking-wider font-semibold">
                        Completion Rate
                      </span>
                      <div className="text-2xl font-mono font-bold text-[var(--foreground)] mt-1">97.2%</div>
                      <span className="text-[10px] text-[var(--muted-foreground)]">Avg time: 38m</span>
                    </div>
                  </div>

                  {/* Participation Curve Chart Visualization */}
                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/20">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <span className="text-xs font-bold text-[var(--foreground)]">
                          Live Participation & Response Flow
                        </span>
                        <span className="text-[10px] text-[var(--muted-foreground)] block">
                          Submission velocity per minute
                        </span>
                      </div>
                      <span className="font-mono text-xs font-semibold text-[var(--primary)]">
                        ● 4,821 attempts logged
                      </span>
                    </div>

                    {/* SVG Curve */}
                    <div className="h-32 w-full flex items-end">
                      <svg viewBox="0 0 500 100" className="w-full h-full stroke-[var(--primary)] fill-[color-mix(in_oklch,var(--primary)_10%,transparent)]">
                        <path
                          d="M 0,90 Q 70,85 120,40 T 250,15 T 380,25 T 500,75 L 500,100 L 0,100 Z"
                          stroke="none"
                        />
                        <path
                          d="M 0,90 Q 70,85 120,40 T 250,15 T 380,25 T 500,75"
                          fill="none"
                          strokeWidth="2.5"
                        />
                      </svg>
                    </div>

                    <div className="flex justify-between text-[10px] text-[var(--muted-foreground)] font-mono mt-2 pt-2 border-t border-[var(--border)]">
                      <span>00:00 (Start)</span>
                      <span>15:00 (Peak load)</span>
                      <span>30:00 (Mid-round)</span>
                      <span>45:00 (Round close)</span>
                    </div>
                  </div>

                  {/* Live Activity Stream */}
                  <div>
                    <span className="text-xs font-bold text-[var(--foreground)] mb-2 block">
                      Live Contest Activity
                    </span>
                    <div className="space-y-1.5 text-xs">
                      <div className="p-2 rounded-lg bg-[var(--secondary)]/30 flex items-center justify-between">
                        <span className="text-[var(--foreground)]">
                          ● Participant <strong className="font-semibold">Priya Kapoor</strong> moved into #2 rank
                        </span>
                        <span className="text-[10px] font-mono text-[var(--muted-foreground)]">10:44:12</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--secondary)]/30 flex items-center justify-between">
                        <span className="text-[var(--foreground)]">
                          ● Proctored snapshot logged for <strong className="font-semibold">Participant #1827</strong>
                        </span>
                        <span className="text-[10px] font-mono text-[var(--warning)] font-semibold">10:43:02</span>
                      </div>
                      <div className="p-2 rounded-lg bg-[var(--secondary)]/30 flex items-center justify-between">
                        <span className="text-[var(--foreground)]">
                          ● Track 1 question set answer verification synchronized (100%)
                        </span>
                        <span className="text-[10px] font-mono text-[var(--muted-foreground)]">10:42:50</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: QUESTIONS */}
              {activeTab === 'questions' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--foreground)]">
                        Question Bank & Section Blueprint
                      </h4>
                      <p className="text-xs text-[var(--muted-foreground)]">50 Questions configured across 3 modules</p>
                    </div>
                    <button className="px-3 py-1.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90">
                      <Plus className="w-3.5 h-3.5" />
                      Add Question
                    </button>
                  </div>

                  <div className="space-y-3">
                    {SAMPLE_QUESTIONS.map((q) => (
                      <div key={q.id} className="p-4 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/20">
                        <div className="flex justify-between items-start mb-2">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--secondary)] text-[var(--muted-foreground)]">
                            Question #{q.id} · {q.category} · {q.topic}
                          </span>
                          <span className="text-xs font-mono font-bold text-[var(--primary)]">{q.difficulty} ({q.points} pts)</span>
                        </div>
                        <p className="text-xs font-semibold text-[var(--foreground)] mb-2.5">{q.question}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          {q.options.map((opt, i) => (
                            <div
                              key={i}
                              className={`p-2 rounded border ${
                                i === q.correctIndex
                                  ? 'border-[var(--success)] bg-[color-mix(in_oklch,var(--success)_10%,var(--card))] font-semibold text-[var(--success)]'
                                  : 'border-[var(--border)] bg-[var(--card)] text-[var(--muted-foreground)]'
                              }`}
                            >
                              {opt}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: PARTICIPANTS */}
              {activeTab === 'participants' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row justify-between gap-3 pb-3 border-b border-[var(--border)]">
                    <div className="relative w-full sm:w-64">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[var(--muted-foreground)]" />
                      <input
                        type="text"
                        placeholder="Search by name, college, dept..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-[var(--secondary)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                      />
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setSelectedFilter('all')}
                        className={`px-2.5 py-1 text-xs rounded font-medium ${selectedFilter === 'all' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'}`}
                      >
                        All (2,318)
                      </button>
                      <button
                        onClick={() => setSelectedFilter('verified')}
                        className={`px-2.5 py-1 text-xs rounded font-medium ${selectedFilter === 'verified' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'}`}
                      >
                        Verified
                      </button>
                      <button
                        onClick={() => setSelectedFilter('flagged')}
                        className={`px-2.5 py-1 text-xs rounded font-medium ${selectedFilter === 'flagged' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]' : 'bg-[var(--secondary)] text-[var(--muted-foreground)]'}`}
                      >
                        Flagged (3)
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-[var(--secondary)]/60 text-[var(--muted-foreground)] uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-2.5">Participant</th>
                          <th className="p-2.5">Institution & Dept</th>
                          <th className="p-2.5">Status</th>
                          <th className="p-2.5">Score</th>
                          <th className="p-2.5">Time Spent</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {filteredParticipants.map((p) => (
                          <tr key={p.id} className="hover:bg-[var(--secondary)]/30">
                            <td className="p-2.5 font-semibold text-[var(--foreground)] flex items-center gap-2">
                              <span className="w-6 h-6 rounded bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center font-bold text-[10px]">
                                {p.avatar}
                              </span>
                              {p.name}
                            </td>
                            <td className="p-2.5 text-[var(--muted-foreground)]">
                              {p.institution} · <span className="text-[11px]">{p.department}</span>
                            </td>
                            <td className="p-2.5">
                              {p.status === 'flagged' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600">
                                  ⚠ In Review ({p.flagsCount})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[color-mix(in_oklch,var(--success)_15%,var(--card))] text-[var(--success)]">
                                  ✓ Verified
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-[var(--foreground)]">{p.score ?? '—'}</td>
                            <td className="p-2.5 font-mono text-[var(--muted-foreground)]">{p.timeSpent}</td>
                            <td className="p-2.5 text-right">
                              <button className="text-xs font-semibold text-[var(--primary)] hover:underline cursor-pointer">
                                Audit Log
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 4: LIVE ROOM */}
              {activeTab === 'live' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                    <span className="text-xs font-bold text-[var(--foreground)] flex items-center gap-2">
                      <Radio className="w-4 h-4 text-red-500 animate-pulse" />
                      Live Room Supervision (Round 3)
                    </span>
                    <span className="text-xs font-mono font-bold text-[var(--primary)]">
                      42:18 remaining
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-4 bg-[var(--secondary)]/30 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--muted-foreground)]">Active WebSockets</span>
                      <div className="text-xl font-mono font-bold text-[var(--foreground)] mt-1">2,104 / 2,318</div>
                      <span className="text-[10px] text-[var(--success)]">91% active concurrencies</span>
                    </div>

                    <div className="p-4 bg-[var(--secondary)]/30 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--muted-foreground)]">Average Answering Time</span>
                      <div className="text-xl font-mono font-bold text-[var(--foreground)] mt-1">42.4s / Q</div>
                      <span className="text-[10px] text-[var(--muted-foreground)]">Within baseline floor</span>
                    </div>

                    <div className="p-4 bg-[var(--secondary)]/30 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--muted-foreground)]">Room Latency</span>
                      <div className="text-xl font-mono font-bold text-[var(--primary)] mt-1">18ms</div>
                      <span className="text-[10px] text-[var(--muted-foreground)]">Cloud Edge Singapore</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)]">
                    <span className="text-xs font-bold text-[var(--foreground)] block mb-2">
                      Room Broadcast Announcement
                    </span>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Broadcast message to all 2,104 active test-takers..."
                        className="flex-1 px-3 py-2 text-xs bg-[var(--secondary)] border border-[var(--border)] rounded-lg text-[var(--foreground)]"
                      />
                      <button className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-xs font-semibold hover:opacity-90">
                        Broadcast
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: PROCTORING */}
              {activeTab === 'proctoring' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                    <span className="text-xs font-bold text-[var(--foreground)]">
                      Integrity Log & Review Queue
                    </span>
                    <span className="text-xs font-mono text-[var(--warning)] font-bold">
                      2 reviews awaiting decision
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {SAMPLE_PROCTOR_ALERTS.map((alert) => (
                      <div
                        key={alert.id}
                        className="p-3.5 rounded-xl border border-[var(--border)] bg-[var(--secondary)]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-3">
                          <AlertCircle
                            className={`w-4 h-4 mt-0.5 ${
                              alert.severity === 'critical'
                                ? 'text-red-500'
                                : alert.severity === 'warning'
                                ? 'text-amber-500'
                                : 'text-green-500'
                            }`}
                          />
                          <div>
                            <div className="font-bold text-[var(--foreground)] flex items-center gap-2">
                              {alert.participantName}
                              <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                                {alert.timestamp}
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">
                              {alert.details}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold hover:opacity-90 cursor-pointer">
                            Inspect Evidence Frame
                          </button>
                          <button className="px-3 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--card)] text-xs font-medium hover:bg-[var(--secondary)] cursor-pointer">
                            Clear Flag
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 6: RESULTS & ANALYTICS */}
              {activeTab === 'results' && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
                    <div>
                      <h4 className="font-bold text-sm text-[var(--foreground)]">
                        Contest Results & Export Suite
                      </h4>
                      <p className="text-xs text-[var(--muted-foreground)]">Instant consolidation for university records</p>
                    </div>
                    <button className="px-3 py-1.5 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-xs font-semibold flex items-center gap-1.5 hover:opacity-90">
                      <Download className="w-3.5 h-3.5" />
                      Export Package (.ZIP)
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-[var(--secondary)]/30 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--muted-foreground)]">Official Top Scorer</span>
                      <div className="text-base font-bold text-[var(--foreground)] mt-1">Aarav Sharma (982)</div>
                      <span className="text-[10px] text-[var(--muted-foreground)] font-mono">MIT Pune · 34m 12s</span>
                    </div>

                    <div className="p-3.5 bg-[var(--secondary)]/30 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--muted-foreground)]">Median Cohort Score</span>
                      <div className="text-base font-bold text-[var(--foreground)] mt-1">72.4% (36.2 / 50)</div>
                      <span className="text-[10px] text-[var(--muted-foreground)]">Standard Deviation: 8.2</span>
                    </div>

                    <div className="p-3.5 bg-[var(--secondary)]/30 rounded-xl border border-[var(--border)]">
                      <span className="text-[11px] text-[var(--muted-foreground)]">Certificates Status</span>
                      <div className="text-base font-bold text-[var(--success)] mt-1">2,318 Ready</div>
                      <span className="text-[10px] text-[var(--muted-foreground)]">Tamper-proof verifiable QR</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-[var(--foreground)]">
                      Ready to publish final verified rankings and issue credentials to candidates?
                    </span>
                    <button className="px-4 py-2 bg-[var(--success)] text-[var(--success-foreground)] rounded-lg text-xs font-bold hover:opacity-90">
                      Lock & Publish Final Results
                    </button>
                  </div>
                </div>
              )}

              {/* Bottom Console Note */}
              <div className="mt-6 pt-3 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--muted-foreground)]">
                <span>QuizBuzz Contest OS v4.2 · Fully isolated sandbox environment</span>
                <span className="font-mono">Audit Token: #SEC-9918-MIT</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}