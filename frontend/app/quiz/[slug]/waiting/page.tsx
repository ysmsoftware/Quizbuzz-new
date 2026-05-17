"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Clock,
  Users,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Play,
  Info,
  AlertTriangle,
  X,
} from "lucide-react";
import { contestService } from "@/lib/services/contest-service";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useWaitingRoomSocket, type BroadcastMessage } from "@/lib/hooks/useWaitingRoomSocket";
import { WSConnectionStatus } from "@/components/features/quiz/WSConnectionStatus";
import { WidgetErrorBoundary } from "@/components/shared/WidgetErrorBoundary";
import type { Contest } from "@/lib/types";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════
interface TimeDiff {
  d: number;
  h: number;
  m: number;
  s: number;
}

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════
export default function WaitingRoomPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  // Auth store
  const sessionToken = useAuthStore((s) => s.sessionToken) || "";
  const participantId = useAuthStore((s) => s.participantId) || "";
  const identifier = useAuthStore((s) => s.identifier) || "";
  const contestId = useAuthStore((s) => s.contestId) || "";

  // Contest data (HTTP)
  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);

  // Countdown
  const [timeToStart, setTimeToStart] = useState<TimeDiff>({ d: 0, h: 0, m: 0, s: 0 });
  const [showAllRules, setShowAllRules] = useState(false);

  // WS hook
  const {
    participantCount,
    wsStatus,
    broadcastMessage,
    clearBroadcast,
    showStartingOverlay,
    contestStartTime,
  } = useWaitingRoomSocket(contestId || slug, participantId, sessionToken);

  // ─── Load contest ───────────────────────────────
  useEffect(() => {
    const load = async () => {
      // Try by slug first if we have it, otherwise by ID
      const res = await (slug ? contestService.getContestBySlug(slug) : contestService.getContestById(contestId));
      if (res.success && res.data) {
        setContest(res.data);
      }
      setLoading(false);
    };
    load();
  }, [slug, contestId]);

  // ─── Countdown timer ───────────────────────────
  useEffect(() => {
    const target = contestStartTime || (contest ? new Date(`${contest.contestDate}T${contest.contestStartTime}:00`) : null);
    if (!target) return;

    const tick = () => {
      const diffMs = target.getTime() - Date.now();
      if (diffMs <= 0) {
        setTimeToStart({ d: 0, h: 0, m: 0, s: 0 });
        // Handle auto-redirect if starting overlay didn't trigger
        return;
      }

      setTimeToStart({
        d: Math.floor(diffMs / 86400000),
        h: Math.floor((diffMs % 86400000) / 3600000),
        m: Math.floor((diffMs % 3600000) / 60000),
        s: Math.floor((diffMs % 60000) / 1000),
      });
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [contest, contestStartTime]);

  // ─── Mask identifier ────────────────────────────
  const maskedContact = useMemo(() => {
    if (!identifier) return "***";
    if (identifier.includes("@")) {
      const [local, domain] = identifier.split("@");
      return `${local.slice(0, 2)}***@${domain}`;
    }
    return identifier.slice(0, 5) + "****" + identifier.slice(-2);
  }, [identifier]);

  // Rules
  const rules = contest?.rules || [
    "Do not switch tabs during the quiz",
    "Keep your face visible to the camera at all times",
    "No external help or resources allowed",
    "Your progress is auto-saved every 30 seconds",
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #0F2040 0%, #0D1117 100%)" }}>
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0F2040 0%, #0D1117 100%)" }}>

      {/* ─── Top Bar ──────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-40 h-[52px] flex items-center justify-between px-4 sm:px-6" style={{ background: "rgba(15,32,64,0.80)", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white/70" />
          </div>
          <span className="text-sm font-semibold text-white/90">QuizCraft Pro</span>
        </div>
        <WSConnectionStatus status={wsStatus} variant="compact" />
      </header>

      {/* ─── Broadcast Banner ─────────────────────── */}
      <AnimatePresence>
        {broadcastMessage && (
          <BroadcastBanner message={broadcastMessage} onDismiss={clearBroadcast} />
        )}
      </AnimatePresence>

      {/* ─── Starting Overlay ─────────────────────── */}
      <AnimatePresence>
        {showStartingOverlay && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(249,115,22,0.95)", backdropFilter: "blur(8px)" }}
          >
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.5 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", damping: 15 }}
              >
                <Play className="w-20 h-20 text-white mx-auto mb-4" fill="white" />
              </motion.div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white">Contest is starting!</h2>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Content ─────────────────────────── */}
      <WidgetErrorBoundary name="Waiting Room Details">
        <main className="flex flex-col items-center pt-24 sm:pt-32 pb-24 px-4">
          <div className="px-4 py-1.5 rounded-full border border-white/20 text-white/80 text-sm font-medium mb-6">
            Waiting Room
          </div>

          <h1 className="text-2xl sm:text-[32px] font-bold text-white text-center max-w-lg leading-tight mb-2" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {contest?.title || "Quiz"}
          </h1>

          <p className="text-white/60 text-sm mb-8">Contest begins in</p>

          <CountdownDisplay time={timeToStart} />

          <div className="mt-8 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <motion.span
              key={participantCount}
              initial={{ opacity: 0.5, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm text-white/70"
            >
              {participantCount.toLocaleString()} participants in the waiting room
            </motion.span>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl w-full">
            <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="text-sm font-semibold text-green-400">Verified</span>
              </div>
              <div className="space-y-3">
                <InfoField label="Participant ID" value={participantId || "—"} mono />
                <InfoField label="Contact" value={maskedContact} />
                <InfoField label="Contest" value={contest?.title || "—"} />
              </div>
            </div>

            <div className="rounded-2xl p-6" style={{ background: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}>
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-white/60" />
                <span className="text-sm font-semibold text-white">What to Expect</span>
              </div>
              <div className="space-y-3">
                <InfoField label="Questions" value={`${contest?.totalQuestions || "—"} questions`} />
                <InfoField label="Total Marks" value={`${contest?.totalMarks || "—"}`} />
              </div>

              <div className="mt-4 pt-3 border-t border-white/10">
                <p className="text-xs text-white/50 mb-2">Rules</p>
                <p className="text-sm text-white/80">• {rules[0]}</p>
                {rules.length > 1 && (
                  <>
                    <AnimatePresence>
                      {showAllRules && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          {rules.slice(1).map((rule, i) => (
                            <p key={i} className="text-sm text-white/80 mt-1">• {rule}</p>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button
                      type="button"
                      onClick={() => setShowAllRules(!showAllRules)}
                      className="flex items-center gap-1 text-xs text-white/50 hover:text-white/70 mt-2 transition-colors"
                    >
                      {showAllRules ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showAllRules ? "Show less" : `View all ${rules.length} rules`}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <p className="mt-12 text-xs text-white/20">Press Ctrl+Shift+S to simulate contest start</p>
        </main>
      </WidgetErrorBoundary>
    </div>
  );
}

function CountdownDisplay({ time }: { time: TimeDiff }) {
  const units = [
    ...(time.d > 0 ? [{ value: time.d, label: "DAYS" }] : []),
    { value: time.h, label: "HRS" },
    { value: time.m, label: "MIN" },
    { value: time.s, label: "SEC" },
  ];

  return (
    <div className="flex items-center gap-3">
      {units.map((unit, i) => (
        <div key={unit.label} className="flex items-center gap-3">
          <div className="flex flex-col items-center">
            <div className="w-[72px] sm:w-20 rounded-xl p-3 sm:p-4 flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
              <motion.span
                key={`${unit.label}-${unit.value}`}
                initial={{ scale: 1.1 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.1 }}
                className="text-3xl sm:text-[56px] font-bold text-white font-mono leading-none"
              >
                {String(unit.value).padStart(2, "0")}
              </motion.span>
            </div>
            <span className="text-[10px] text-white/40 uppercase tracking-[0.1em] mt-2 font-medium">
              {unit.label}
            </span>
          </div>

          {i < units.length - 1 && (
            <span className="text-white/30 text-2xl sm:text-[32px] font-bold self-start mt-3 sm:mt-4">:</span>
          )}
        </div>
      ))}
    </div>
  );
}

function BroadcastBanner({ message, onDismiss }: { message: BroadcastMessage; onDismiss: () => void }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const duration = 10000;

    const tick = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        onDismiss();
        clearInterval(tick);
      }
    }, 50);

    return () => clearInterval(tick);
  }, [onDismiss]);

  const bgMap = {
    info: "rgba(29,78,216,0.90)",
    warning: "rgba(180,83,9,0.90)",
    urgent: "rgba(185,28,28,0.90)",
  };

  const borderMap = {
    info: "#3B82F6",
    warning: "#F59E0B",
    urgent: "#EF4444",
  };

  const iconMap = {
    info: Info,
    warning: AlertTriangle,
    urgent: AlertTriangle,
  };

  const Icon = iconMap[message.type];

  return (
    <motion.div
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -60, opacity: 0 }}
      className="fixed top-[52px] left-0 right-0 z-50"
    >
      <div
        className="mx-4 mt-2 rounded-lg border p-3 flex items-center gap-3"
        style={{ background: bgMap[message.type], borderColor: borderMap[message.type] }}
      >
        <Icon className="w-5 h-5 text-white flex-shrink-0" />
        <span className="text-sm text-white flex-1">{message.text}</span>
        <button type="button" onClick={onDismiss} className="text-white/60 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mx-4 h-[3px] rounded-b-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
        <div className="h-full transition-all duration-100" style={{ width: `${progress}%`, background: borderMap[message.type] }} />
      </div>
    </motion.div>
  );
}

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs text-white/40">{label}</p>
      <p className={`text-sm text-white/90 ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
