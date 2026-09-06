'use client';

import React from 'react';
import { Terminal, Brain, Code2, LineChart, BookOpen, Sparkles } from 'lucide-react';

export const ContestTypesSection: React.FC = () => {
  const categories = [
    {
      title: 'Technical Quizzes',
      focus: 'Computer Science, Systems & AI',
      desc: 'Deep dives into algorithms, system design, data architectures, and DevOps problem-solving.',
      icon: Terminal,
      sample: 'Ex: National Systems Challenge',
    },
    {
      title: 'Aptitude Sprints',
      focus: 'Quantitative, Logic & Analytics',
      desc: 'High-speed analytical reasoning, placement aptitude tests, and quantitative benchmarks.',
      icon: Brain,
      sample: 'Ex: Campus Aptitude Sprint 2026',
    },
    {
      title: 'Coding Competitions',
      focus: 'Competitive DSA & Speed Runs',
      desc: 'Multi-round timed programming tournaments featuring instant execution and live testcase grading.',
      icon: Code2,
      sample: 'Ex: Winter Inter-College Coding Cup',
    },
    {
      title: 'Commerce & Finance',
      focus: 'Markets, Valuation & Case Study',
      desc: 'Real-world business case analyses, financial accounting drills, and economics simulations.',
      icon: LineChart,
      sample: 'Ex: Inter-College Commerce Quiz',
    },
    {
      title: 'Academic Olympiads',
      focus: 'Core Sciences & Engineering',
      desc: 'Challenging inter-collegiate knowledge battles across physics, mathematics, and electrical principles.',
      icon: BookOpen,
      sample: 'Ex: Meridian STEM Olympiad',
    },
  ];

  return (
    <section className="py-16 md:py-24 bg-[var(--card)] border-y border-[var(--border)] transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[var(--primary)]/10 text-[var(--primary)] mb-3">
            <span>CONTENT QUALITY</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] mb-3">
            Give your audience something worth discovering.
          </h2>
          <p className="text-base sm:text-lg text-[var(--muted-foreground)] leading-relaxed">
            Ambassadors don't push gimmicks or spam. You represent high-caliber competitions organized by legitimate institutions that students genuinely want on their resumes.
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.title}
                className="p-6 rounded-2xl border border-[var(--border)] bg-[var(--background)] hover:border-[var(--primary)]/50 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--primary)] block mb-1">
                    {cat.focus}
                  </span>
                  <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">
                    {cat.title}
                  </h3>
                  <p className="text-xs text-[var(--muted-foreground)] leading-relaxed mb-4">
                    {cat.desc}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border)] text-[11px] font-semibold text-[var(--muted-foreground)] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{cat.sample}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};