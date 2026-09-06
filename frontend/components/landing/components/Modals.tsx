'use client';

import { ShieldCheck } from 'lucide-react';

interface VerifyCertificateModalProps {
  isOpen: boolean;
  code: string;
  onClose: () => void;
}

export function VerifyCertificateModal({ isOpen, code, onClose }: VerifyCertificateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 shadow-2xl text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-[color-mix(in_oklch,var(--success)_15%,var(--card))] text-[var(--success)] flex items-center justify-center mx-auto border border-[color-mix(in_oklch,var(--success)_30%,var(--border))]">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--success)] font-bold block">
            Cryptographically Authenticated
          </span>
          <h3 className="text-lg font-bold text-[var(--foreground)] mt-1">
            Credential Record Verified
          </h3>
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
            Certificate ID: <strong className="font-mono text-[var(--foreground)]">{code}</strong>
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[var(--secondary)]/50 border border-[var(--border)] text-left text-xs space-y-2 font-mono">
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Recipient:</span>
            <span className="font-bold text-[var(--foreground)]">Arjun Mehta</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Contest:</span>
            <span className="text-[var(--foreground)]">National Aptitude Sprint 2026</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Official Rank:</span>
            <span className="font-bold text-[var(--primary)]">#7 of 2,318</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Final Score:</span>
            <span className="text-[var(--foreground)]">926 / 1000 pts</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--muted-foreground)]">Issued By:</span>
            <span className="text-[var(--foreground)]">Meridian State University</span>
          </div>
          <div className="flex justify-between pt-1 border-t border-[var(--border)] text-[10px]">
            <span className="text-[var(--muted-foreground)]">SHA-256 Digest:</span>
            <span className="truncate max-w-[160px] text-[var(--muted-foreground)]">0x9f7a...3c82e</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer"
        >
          Close Verification Portal
        </button>
      </div>
    </div>
  );
}
