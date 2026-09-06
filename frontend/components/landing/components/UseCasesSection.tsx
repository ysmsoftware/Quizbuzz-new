'use client';

import { GraduationCap, School, Building2, Trophy, ArrowRight } from 'lucide-react';

interface UseCasesSectionProps {
  onCreateContest: () => void;
}

export function UseCasesSection({ onCreateContest }: UseCasesSectionProps) {
  const useCases = [
    {
      title: 'Universities & Colleges',
      subtitle: 'Entrance tests, aptitude rounds & department leagues',
      icon: GraduationCap,
      description: 'Department coordinators run entrance sprints, coding rounds, and aptitude prelims with automatic institution-wise and branch-wise rollups.',
      highlights: [
        'Inter-college hackathons & aptitude qualifiers',
        'Campus placement screening rounds',
        'Faculty-moderated semester quizzes',
      ],
      tag: 'Academic Scale',
    },
    {
      title: 'Schools & Olympiad Boards',
      subtitle: 'National quizzes, academic championships & STEM cups',
      icon: School,
      description: 'Run national or regional school competitions where thousands of younger candidates compete in secure, distraction-free kiosk sessions.',
      highlights: [
        'National Science & Math Olympiads',
        'Inter-school general knowledge cups',
        'State-wide scholarship screening quizzes',
      ],
      tag: 'K-12 Secure',
    },
    {
      title: 'Enterprises & Companies',
      subtitle: 'Hiring assessments, tech challenges & internal hackathons',
      icon: Building2,
      description: 'Screen candidate cohorts with customizable question banks, strict browser integrity controls, and executive-ready ranking exports.',
      highlights: [
        'Graduate engineer trainee hiring rounds',
        'Internal company hackathon qualifiers',
        'Continuous learning & compliance certifications',
      ],
      tag: 'Enterprise Ready',
    },
    {
      title: 'Quiz Organizers & Communities',
      subtitle: 'Public prize competitions & sponsored championship circuits',
      icon: Trophy,
      description: 'Independent quizmasters, tech communities, and NGOs host paid-entry or sponsored competitions with verifiable winner rankings.',
      highlights: [
        'Weekend prize championships with paid tickets',
        'Developer community knowledge challenges',
        'Sponsored brand awareness trivia leagues',
      ],
      tag: 'Public Leagues',
    },
  ];

  return (
    <section className="py-20 bg-[var(--secondary)]/30 border-b border-[var(--border)] relative" id="solutions">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-4">
            <Trophy className="w-3.5 h-3.5" />
            Built For Serious Competitions
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
            One platform. Every kind of competition.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            From departmental tests to national Olympiads with thousands of test-takers —<br />
            all on the same battle-tested infrastructure.
          </p>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {useCases.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className="p-6 sm:p-7 rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-md hover:shadow-lg hover:border-[var(--primary)]/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-[var(--secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--primary)]">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--secondary)] text-[var(--muted-foreground)] border border-[var(--border)]">
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-[var(--foreground)]">{item.title}</h3>
                  <p className="text-xs font-semibold text-[var(--primary)] mt-0.5">{item.subtitle}</p>

                  <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-3 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="mt-4 pt-3 border-t border-[var(--border)] space-y-2">
                    {item.highlights.map((hl, hIdx) => (
                      <div key={hIdx} className="text-xs text-[var(--foreground)] flex items-center gap-2 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
                        {hl}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-3">
                  <button
                    onClick={onCreateContest}
                    className="text-xs font-semibold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    Launch this competition format
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}