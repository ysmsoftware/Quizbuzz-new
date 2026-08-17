'use client';

import { motion } from 'framer-motion';
import { MonitorOff, ArrowRight, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter, useParams } from 'next/navigation';

// ═══════════════════════════════════════════════════════
// SessionConflictPage — Shown when another device takes over
// ═══════════════════════════════════════════════════════

export function SessionConflictPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full text-center">
        {/* Disconnected Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-10 border border-destructive/20"
        >
          <MonitorOff className="w-12 h-12 text-destructive" />
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <h1 className="text-3xl font-bold text-foreground mb-4">Session Conflict</h1>
          <p className="text-muted-foreground mb-10 leading-relaxed text-lg">
            Your quiz session was opened on another device.
            For security, this session has been disconnected.
          </p>

          <div className="bg-muted/40 rounded-2xl p-6 mb-10 border border-border/40 flex items-start gap-4 text-left">
            <ShieldAlert className="w-6 h-6 text-warning shrink-0" />
            <p className="text-sm text-muted-foreground">
              Don't worry, your answers have been safely saved up to this point.
              Only one active session is allowed per participant.
            </p>
          </div>

          <Button
            onClick={() => router.push(slug ? `/quiz/${slug}/join` : '/contests')}
            className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg shadow-xl shadow-primary/20 flex items-center justify-center gap-2"
          >
            Re-enter from this device
            <ArrowRight className="w-5 h-5" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
