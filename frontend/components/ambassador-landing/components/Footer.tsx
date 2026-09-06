'use client';

import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--background)] py-12 text-xs text-[var(--muted-foreground)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Col */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="h-7 w-7 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center font-black text-sm">
                Q
              </div>
              <span className="font-extrabold tracking-tight text-base text-[var(--foreground)]">
                QuizBuzz
              </span>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed max-w-sm mb-4">
              The distribution and competition platform connecting university challenges with ambitious students and campus leaders.
            </p>
            <div className="text-[11px] font-mono text-[var(--muted-foreground)]">
              QuizBuzz Ambassador Program • Ecosystem Edition
            </div>
          </div>

          {/* Col 1 */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--foreground)] mb-3">
              Ambassador Program
            </h4>
            <ul className="space-y-2">
              <li><a href="#campaigns" className="hover:text-[var(--foreground)] transition-colors">Campaign Marketplace</a></li>
              <li><a href="#ecosystem" className="hover:text-[var(--foreground)] transition-colors">The Network</a></li>
              <li><a href="#dashboard" className="hover:text-[var(--foreground)] transition-colors">Ambassador Dashboard</a></li>
              <li><a href="#how-it-works" className="hover:text-[var(--foreground)] transition-colors">How it Works</a></li>
              <li><a href="#faq" className="hover:text-[var(--foreground)] transition-colors">FAQ</a></li>
            </ul>
          </div>

          {/* Col 2 */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--foreground)] mb-3">
              Contest Platform
            </h4>
            <ul className="space-y-2">
              <li><a href="/" className="hover:text-[var(--foreground)] transition-colors">Platform Overview</a></li>
              <li><a href="/register" className="hover:text-[var(--foreground)] transition-colors">Host a Competition</a></li>
              <li><a href="#" className="hover:text-[var(--foreground)] transition-colors">Test Engine &amp; Proctoring</a></li>
              <li><a href="#" className="hover:text-[var(--foreground)] transition-colors">Leaderboards</a></li>
              <li><a href="#" className="hover:text-[var(--foreground)] transition-colors">Certificates</a></li>
            </ul>
          </div>

          {/* Col 3 */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[var(--foreground)] mb-3">
              Legal &amp; Trust
            </h4>
            <ul className="space-y-2">
              <li><a href="#" className="hover:text-[var(--foreground)] transition-colors">Ambassador Code of Conduct</a></li>
              <li><a href="#" className="hover:text-[var(--foreground)] transition-colors">Referral &amp; Payout Terms</a></li>
              <li><a href="/privacy" className="hover:text-[var(--foreground)] transition-colors">Privacy Policy</a></li>
              <li><a href="/terms" className="hover:text-[var(--foreground)] transition-colors">Terms of Service</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[var(--border)] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <div>
            © {new Date().getFullYear()} QuizBuzz Technologies Inc. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <span>Server Status: Operational</span>
            <span>•</span>
            <span>Audited Referral Attribution</span>
          </div>
        </div>
      </div>
    </footer>
  );
};