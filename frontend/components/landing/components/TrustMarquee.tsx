'use client';

export function TrustMarquee() {
  const institutions = [
    'Ashcroft Institute of Technology',
    'Meridian State University',
    'Dr. Kalam Polytechnic & Science Labs',
    'Northfield College of Commerce',
    'Sable Ridge University',
    'Portmore Institute of Management',
    'Pune Engineering Consortium',
    'All-India Collegiate Coding Chapters',
    'National STEM Olympiad Society',
  ];

  return (
    <section className="py-12 border-b border-[var(--border)] bg-[var(--secondary)]/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Built for competitions that can't afford chaos
          </span>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Trusted by examination boards, autonomous colleges, university hackathons and national quiz organizers
          </p>
        </div>

        {/* Marquee Row */}
        <div className="overflow-hidden mask-radial-fade py-2">
          <div className="flex gap-10 whitespace-nowrap animate-marquee">
            {[...institutions, ...institutions].map((name, i) => (
              <span
                key={i}
                className="text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors inline-flex items-center gap-3 cursor-default"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] opacity-60" />
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Key Operational Proof Points */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-10 pt-8 border-t border-[var(--border)]">
          <div className="text-center p-3">
            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[var(--foreground)]">
              5,000+
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">
              Tested concurrent participants in one live room
            </div>
          </div>

          <div className="text-center p-3">
            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[var(--primary)]">
              0s
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">
              Leaderboard delay on live submissions
            </div>
          </div>

          <div className="text-center p-3">
            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[var(--foreground)]">
              100%
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">
              Proctoring flags evidence-backed (Zero auto-fail)
            </div>
          </div>

          <div className="text-center p-3">
            <div className="font-mono text-2xl sm:text-3xl font-extrabold text-[var(--foreground)]">
              Instant
            </div>
            <div className="text-xs text-[var(--muted-foreground)] mt-1">
              Cryptographically verified certificate generation
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}