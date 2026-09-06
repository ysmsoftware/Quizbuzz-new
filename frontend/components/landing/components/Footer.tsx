'use client';

import { Trophy } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[var(--card)] border-t border-[var(--border)] pt-16 pb-12 text-xs text-[var(--muted-foreground)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Col */}
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center font-bold text-xs shadow-xs">
                <Trophy className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
              <span className="font-bold text-base text-[var(--foreground)] tracking-tight">
                QuizBuzz
              </span>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] max-w-sm leading-relaxed">
              The infrastructure that powers modern online contests — from registration and payments to proctoring, live rankings, analytics and verified certificates.
            </p>
            <div className="pt-2 flex items-center gap-2 text-[11px] font-mono">
              <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
              <span>All Systems Operational (99.98% SLA)</span>
            </div>
          </div>

          {/* Col 1: Product */}
          <div className="space-y-2.5">
            <h5 className="font-semibold text-[var(--foreground)] uppercase tracking-wider text-[11px]">
              Platform
            </h5>
            <ul className="space-y-2">
              <li><a href="#how-it-works" className="hover:text-[var(--foreground)] transition-colors">How It Works</a></li>
              <li><a href="#organizers" className="hover:text-[var(--foreground)] transition-colors">Organizer Command Center</a></li>
              <li><a href="#proctoring" className="hover:text-[var(--foreground)] transition-colors">Proctoring & Integrity</a></li>
              <li><a href="#monitoring" className="hover:text-[var(--foreground)] transition-colors">Live Room Supervision</a></li>
              <li><a href="#certificates" className="hover:text-[var(--foreground)] transition-colors">Verifiable Certificates</a></li>
            </ul>
          </div>

          {/* Col 2: Solutions */}
          <div className="space-y-2.5">
            <h5 className="font-semibold text-[var(--foreground)] uppercase tracking-wider text-[11px]">
              Solutions
            </h5>
            <ul className="space-y-2">
              <li><a href="#solutions" className="hover:text-[var(--foreground)] transition-colors">Universities & Colleges</a></li>
              <li><a href="#solutions" className="hover:text-[var(--foreground)] transition-colors">K-12 & Olympiads</a></li>
              <li><a href="#solutions" className="hover:text-[var(--foreground)] transition-colors">Enterprise Hiring</a></li>
              <li><a href="#solutions" className="hover:text-[var(--foreground)] transition-colors">Tech Communities</a></li>
              <li><a href="#scale" className="hover:text-[var(--foreground)] transition-colors">High Concurrency (5k+)</a></li>
            </ul>
          </div>

          {/* Col 3: Resources & Legal */}
          <div className="space-y-2.5">
            <h5 className="font-semibold text-[var(--foreground)] uppercase tracking-wider text-[11px]">
              Resources
            </h5>
            <ul className="space-y-2">
              <li><a href="#faq" className="hover:text-[var(--foreground)] transition-colors">FAQ</a></li>
              <li><a href="#branding" className="hover:text-[var(--foreground)] transition-colors">White-Label Guide</a></li>
              <li><a href="/faq" className="hover:text-[var(--foreground)] transition-colors">Exam Cell SLA Spec</a></li>
              <li><a href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy & GDPR</a></li>
              <li><a href="/terms" className="hover:text-[var(--foreground)] transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="pt-8 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <p>© 2026 QuizBuzz Infrastructure Inc. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <span className="font-mono">Engine v4.2.8</span>
            <span>·</span>
            <span>Global Edge Nodes</span>
            <span>·</span>
            <span>Privacy Preserved</span>
          </div>
        </div>
      </div>
    </footer>
  );
}