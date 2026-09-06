'use client';

import { useState } from 'react';
import { Compass, UserCheck, Terminal, Award, ChevronRight, ArrowRight } from 'lucide-react';

interface ParticipantExperienceProps {
  onExploreContests: () => void;
}

export function ParticipantExperience({ onExploreContests }: ParticipantExperienceProps) {
  const [activeStep, setActiveStep] = useState(0);

  const participantSteps = [
    {
      id: 0,
      title: '1. Discover',
      subtitle: 'Find contests by topic, campus, or league',
      icon: Compass,
      screen: {
        heading: 'Discover Contests',
        desc: 'Filter by engineering, medical, mathematics, coding, and aptitude leagues with transparent rules.',
        chip: 'Open Registrations',
      },
    },
    {
      id: 1,
      title: '2. Check-In',
      subtitle: '30-second seamless camera & browser calibration',
      icon: UserCheck,
      screen: {
        heading: 'System Check-In',
        desc: 'Verify camera, mic, and screen lock in seconds without requiring intrusive desktop software downloads.',
        chip: '100% In-Browser',
      },
    },
    {
      id: 2,
      title: '3. Compete',
      subtitle: 'Focus mode with auto-save & zero lag',
      icon: Terminal,
      screen: {
        heading: 'Distraction-Free Kiosk',
        desc: 'Full-screen focus mode with instant local saving. If your network drops, your time and answers remain safe.',
        chip: 'Auto-Saved State',
      },
    },
    {
      id: 3,
      title: '4. Recognize',
      subtitle: 'Instant rank & tamper-proof certificate',
      icon: Award,
      screen: {
        heading: 'Certified Achievement',
        desc: 'Your rank updates the second the contest closes. Download your verified certificate to share on LinkedIn or resumes.',
        chip: 'Public QR Check',
      },
    },
  ];

  return (
    <section className="py-20 bg-[var(--background)] border-b border-[var(--border)] relative" id="participants">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider mb-4">
            <UserCheck className="w-3.5 h-3.5" />
            For Participants
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
            A better way to compete.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-[var(--muted-foreground)] max-w-2xl mx-auto">
            Find a contest, register once, and verify your setup in a minute —<br />
            compete live, then see where you stand when the clock stops.
          </p>
        </div>

        {/* Step Selector Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-4xl mx-auto mb-10">
          {participantSteps.map((st) => {
            const Icon = st.icon;
            const isActive = activeStep === st.id;
            return (
              <button
                key={st.id}
                onClick={() => setActiveStep(st.id)}
                className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  isActive
                    ? 'border-[var(--primary)] bg-[var(--card)] shadow-md ring-1 ring-[var(--primary)]'
                    : 'border-[var(--border)] bg-[var(--secondary)]/30 hover:bg-[var(--card)] text-[var(--muted-foreground)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[var(--primary)]' : 'text-[var(--muted-foreground)]'}`} />
                  <span className="text-[10px] font-mono font-bold">{st.id + 1}/4</span>
                </div>
                <h4 className={`text-xs font-bold ${isActive ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]'}`}>
                  {st.title}
                </h4>
                <p className="text-[11px] text-[var(--muted-foreground)] mt-0.5 line-clamp-2">
                  {st.subtitle}
                </p>
              </button>
            );
          })}
        </div>

        {/* Interactive Device Screen Preview */}
        <div className="max-w-3xl mx-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-6 sm:p-8">
          <div className="flex justify-between items-center pb-4 border-b border-[var(--border)] mb-6">
            <span className="text-xs font-mono font-semibold text-[var(--primary)]">
              PARTICIPANT EXPERIENCE · {participantSteps[activeStep].screen.chip}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">Step {activeStep + 1} of 4</span>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-bold text-[var(--foreground)]">
              {participantSteps[activeStep].screen.heading}
            </h3>
            <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
              {participantSteps[activeStep].screen.desc}
            </p>

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={onExploreContests}
                className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-xs font-semibold hover:opacity-90 flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                Browse Contests Now
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="flex gap-1">
                {participantSteps.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setActiveStep(st.id)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      activeStep === st.id ? 'bg-[var(--primary)] w-6' : 'bg-[var(--border)]'
                    }`}
                    aria-label={`Go to step ${st.id + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}