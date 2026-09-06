'use client';

import { useState, useRef, MouseEvent } from 'react';
import { Award, CheckCircle2, QrCode, Sparkles, ExternalLink, ShieldCheck, Download } from 'lucide-react';
import { CertificateVariant } from '../types';

interface CertificateSectionProps {
  onVerifyClick: (code: string) => void;
}

export function CertificateSection({ onVerifyClick }: CertificateSectionProps) {
  const [variant, setVariant] = useState<CertificateVariant>('classic');
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: px * 10, y: -py * 10 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  return (
    <section className="py-20 bg-[var(--secondary)]/30 border-b border-[var(--border)] relative" id="certificates">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Column: Narrative Copy */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] bg-[var(--card)] text-xs font-semibold text-[var(--primary)] uppercase tracking-wider">
              <Award className="w-3.5 h-3.5" />
              Verified Credentials
            </div>

            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--foreground)] text-balance">
              Turn results into recognition.
            </h2>

            <p className="text-base text-[var(--muted-foreground)] leading-relaxed">
              Every certificate carries a cryptographic verification hash tied to that specific contest, round, score, and rank — not an editable PDF anyone can forge in Photoshop.
            </p>

            <ul className="space-y-3.5 text-sm text-[var(--foreground)]">
              <li className="flex items-start gap-3">
                <div className="p-1 rounded bg-[color-mix(in_oklch,var(--success)_15%,var(--card))] text-[var(--success)] mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span>
                  <strong>Issued the moment the contest closes:</strong> Automatically signed and dispatched without manual signing queues.
                </span>
              </li>

              <li className="flex items-start gap-3">
                <div className="p-1 rounded bg-[color-mix(in_oklch,var(--success)_15%,var(--card))] text-[var(--success)] mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span>
                  <strong>Bring your institution's letterhead:</strong> Upload logo, seal, and authorized registrar signatures once; all certificates inherit it.
                </span>
              </li>

              <li className="flex items-start gap-3">
                <div className="p-1 rounded bg-[color-mix(in_oklch,var(--success)_15%,var(--card))] text-[var(--success)] mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <span>
                  <strong>Public verification portal:</strong> Employers and university admissions check candidate credentials with zero login required.
                </span>
              </li>
            </ul>

            {/* Template Variant Swatches */}
            <div className="pt-2">
              <span className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider block mb-2.5">
                Select Layout Archetype:
              </span>
              <div className="flex gap-2.5">
                {[
                  { id: 'classic', label: 'Classic Seal', desc: 'Formal academic gold borders' },
                  { id: 'modern', label: 'Modern Clean', desc: 'Minimalist tech typography' },
                  { id: 'minimal', label: 'Engineering Mono', desc: 'Strict typographic monospace' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setVariant(item.id as CertificateVariant)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                      variant === item.id
                        ? 'border-[var(--primary)] bg-[var(--card)] text-[var(--primary)] shadow-sm ring-1 ring-[var(--primary)]'
                        : 'border-[var(--border)] bg-[var(--card)]/60 text-[var(--muted-foreground)] hover:text-[var(--foreground)]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Interactive 3D Tilted Certificate Card */}
          <div className="lg:col-span-7 flex justify-center">
            <div
              ref={cardRef}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{
                transform: `perspective(1000px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)`,
                transition: 'transform 0.1s ease-out',
              }}
              className={`w-full max-w-lg rounded-2xl p-6 sm:p-8 relative shadow-2xl transition-all duration-300 border ${
                variant === 'classic'
                  ? 'bg-gradient-to-br from-[var(--card)] via-[var(--card)] to-[var(--secondary)] border-[var(--border)] ring-4 ring-[var(--accent)]/30'
                  : variant === 'modern'
                  ? 'bg-[var(--card)] border-[var(--primary)]/70 ring-1 ring-[var(--primary)]/30'
                  : 'bg-[var(--card)] border-[var(--border)]'
              }`}
            >
              {/* Inner Decorative Border */}
              <div className="border border-dashed border-[var(--border)] rounded-xl p-5 sm:p-7 flex flex-col justify-between min-h-[360px] relative overflow-hidden">
                {/* Header with Seal */}
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--primary)] font-mono">
                      QuizBuzz Verified Credential
                    </span>
                    <h3 className="text-sm font-bold text-[var(--foreground)] mt-0.5">
                      National Aptitude Sprint 2026
                    </h3>
                  </div>

                  {variant !== 'minimal' && (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--primary)] text-[var(--accent-foreground)] font-extrabold text-[10px] flex items-center justify-center shadow-sm border border-[var(--border)]">
                      SEAL
                    </div>
                  )}
                </div>

                {/* Center Recipient Content */}
                <div className="text-center my-6">
                  <span className="text-[11px] uppercase tracking-widest text-[var(--muted-foreground)] block">
                    This certifies that
                  </span>

                  <h2 className="text-2xl sm:text-3xl font-extrabold text-[var(--foreground)] tracking-tight mt-1">
                    Arjun Mehta
                  </h2>

                  <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-2 max-w-sm mx-auto">
                    secured rank <strong className="text-[var(--foreground)] font-bold">7th</strong> out of 2,318 participants in the
                    Engineering & Aptitude Competition.
                  </p>

                  <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-0.5 rounded-full bg-[color-mix(in_oklch,var(--success)_15%,var(--card))] text-[var(--success)] text-[11px] font-semibold border border-[color-mix(in_oklch,var(--success)_30%,var(--border))]">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified & Authenticated
                  </div>
                </div>

                {/* Footer with QR & Code */}
                <div className="pt-4 border-t border-[var(--border)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-[var(--secondary)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)]">
                      <QrCode className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] text-[var(--muted-foreground)] block font-mono">
                        Verification Hash
                      </span>
                      <button
                        onClick={() => onVerifyClick('QB-7F3K-9XLQ')}
                        className="text-xs font-mono font-bold text-[var(--primary)] hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        QB-7F3K-9XLQ
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right text-[10px] text-[var(--muted-foreground)]">
                    <div>Issued: Sept 2026</div>
                    <div className="font-semibold text-[var(--foreground)]">Exam Cell Registry</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}