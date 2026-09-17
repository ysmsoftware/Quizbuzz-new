'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';

interface VerifyCertificateModalProps {
  isOpen: boolean;
  code: string;
  onClose: () => void;
}

export function VerifyCertificateModal({ isOpen, code, onClose }: VerifyCertificateModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Focus the (only) interactive element on open, close on Escape, and keep
  // focus trapped there — there is exactly one control, so trapping is just
  // refusing to let Tab move focus off it.
  useEffect(() => {
    if (!isOpen) return;
    closeButtonRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          role="presentation"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.01 : 0.15 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="verify-cert-title"
            onClick={(e) => e.stopPropagation()}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 4 }}
            transition={
              prefersReducedMotion
                ? { duration: 0.01 }
                : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }
            }
            className="bg-[var(--card)] border border-[var(--border)] rounded-2xl w-full max-w-md p-6 shadow-2xl text-center space-y-4"
          >
        <div className="w-12 h-12 rounded-full bg-[color-mix(in_oklch,var(--success)_15%,var(--card))] text-[var(--success)] flex items-center justify-center mx-auto border border-[color-mix(in_oklch,var(--success)_30%,var(--border))]">
          <ShieldCheck className="w-6 h-6" />
        </div>

        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[var(--success)] font-bold block">
            Cryptographically Authenticated
          </span>
          <h3 id="verify-cert-title" className="text-lg font-bold text-[var(--foreground)] mt-1">
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
          ref={closeButtonRef}
          onClick={onClose}
          className="w-full py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-xs font-semibold hover:opacity-90 cursor-pointer"
        >
          Close Verification Portal
        </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
