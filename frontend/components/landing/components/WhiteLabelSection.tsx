'use client';

import { useState } from 'react';
import { Palette, Check, Sparkles } from 'lucide-react';

export function WhiteLabelSection() {
  const [activeBrandColor, setActiveBrandColor] = useState<string>('#0d9488'); // teal default
  const [brandName, setBrandName] = useState<string>('Meridian State University');

  const brandPalettes = [
    { name: 'Emerald Teal', hex: '#0d9488' },
    { name: 'Academic Navy', hex: '#2563eb' },
    { name: 'Crimson Burgundy', hex: '#be123c' },
    { name: 'Deep Purple', hex: '#7e22ce' },
    { name: 'Obsidian Black', hex: '#18181b' },
  ];

  return (
    <section className="py-20 bg-[var(--secondary)]/30 border-b border-[var(--border)] relative" id="branding">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column Copy */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider">
              <Palette className="w-3.5 h-3.5" />
              Institutional Customization
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
              Your competition. Your brand.
            </h2>

            <p className="text-base text-[var(--muted-foreground)] leading-relaxed">
              Give participants an experience that feels 100% native to your university or organization. From custom portal domains and color tokens to official seal watermarks on certificates.
            </p>

            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider block mb-2">
                  Test Your Brand Colors:
                </label>
                <div className="flex gap-3">
                  {brandPalettes.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => setActiveBrandColor(c.hex)}
                      style={{ backgroundColor: c.hex }}
                      className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center cursor-pointer transition-transform hover:scale-110"
                      title={c.name}
                    >
                      {activeBrandColor === c.hex && <Check className="w-4 h-4 text-white stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider block mb-1">
                  Institution Name:
                </label>
                <input
                  type="text"
                  value={brandName}
                  onChange={(e) => setBrandName(e.target.value)}
                  className="px-3.5 py-2 text-xs rounded-lg border border-[var(--border)] bg-[var(--card)] text-[var(--foreground)] w-full max-w-sm"
                />
              </div>
            </div>
          </div>

          {/* Right Column: Live Mockup with Brand Color Applied */}
          <div className="lg:col-span-6">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-2xl p-6 relative overflow-hidden">
              <div
                className="h-2 w-full absolute top-0 left-0"
                style={{ backgroundColor: activeBrandColor }}
              />

              <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: activeBrandColor }}
                  >
                    {brandName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-[var(--foreground)]">{brandName}</div>
                    <div className="text-[10px] text-[var(--muted-foreground)] font-mono">
                      contest.meridian.edu · Powered by QuizBuzz
                    </div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--secondary)] text-[var(--muted-foreground)]">
                  White-Labeled
                </span>
              </div>

              <div className="py-6 space-y-3">
                <div className="p-4 rounded-xl bg-[var(--secondary)]/40 border border-[var(--border)]">
                  <span className="text-xs font-bold text-[var(--foreground)] block">
                    Annual STEM Aptitude Sprint 2026
                  </span>
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">
                    Welcome candidates. Please authenticate with your university email to proceed into the kiosk.
                  </p>
                  <button
                    style={{ backgroundColor: activeBrandColor }}
                    className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-xs"
                  >
                    Enter Examination Portal
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-[var(--muted-foreground)] pt-3 border-t border-[var(--border)] flex justify-between">
                <span>Custom CNAME domain supported</span>
                <span>Custom SSL termination included</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}