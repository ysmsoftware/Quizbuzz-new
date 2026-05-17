'use client';

import { motion } from 'framer-motion';
import { MonitorOff, ArrowRight, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

// ═══════════════════════════════════════════════════════
// SessionConflictPage — Shown when another device takes over
// ═══════════════════════════════════════════════════════

export function SessionConflictPage() {
  const router = useRouter();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950 p-6">
      <div className="max-w-md w-full text-center">
        {/* Disconnected Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-10 border border-red-500/20 shadow-2xl shadow-red-500/10"
        >
          <MonitorOff className="w-12 h-12 text-red-500" />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-3xl font-bold text-white mb-4">Session Conflict</h1>
          <p className="text-white/60 mb-10 leading-relaxed text-lg">
            Your quiz session was opened on another device. 
            For security, this session has been disconnected.
          </p>

          <div className="bg-white/5 rounded-2xl p-6 mb-10 border border-white/5 flex items-start gap-4 text-left">
            <ShieldAlert className="w-6 h-6 text-amber-500 shrink-0" />
            <p className="text-sm text-white/70">
              Don't worry, your answers have been safely saved up to this point. 
              Only one active session is allowed per participant.
            </p>
          </div>

          <Button
            onClick={() => router.push('/contests')}
            className="w-full h-14 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-lg shadow-xl shadow-orange-500/20 flex items-center justify-center gap-2"
          >
            Re-enter from this device
            <ArrowRight className="w-5 h-5" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
