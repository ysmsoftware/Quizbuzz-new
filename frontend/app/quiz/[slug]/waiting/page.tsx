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
    Sparkles,
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
    const [contest, setContest] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Countdown
    const [timeToStart, setTimeToStart] = useState<TimeDiff>({ d: 0, h: 0, m: 0, s: 0 });
    const [showAllRules, setShowAllRules] = useState(false);
    const [startCountdown, setStartCountdown] = useState<number | null>(null);

    // WS hook
    const {
        participantCount,
        wsStatus,
        broadcastMessage,
        clearBroadcast,
        showStartingOverlay,
        contestStartTime,
    } = useWaitingRoomSocket(
        contestId || contest?.id || '',
        participantId,
        sessionToken,
        {
            onUnauthorized: () => {
                useAuthStore.getState().clearSession();
                router.replace(`/quiz/${slug}/join`);
            },
        },
    );

    // ─── Require participant session ──────────────
    useEffect(() => {
        if (!sessionToken) {
            router.replace(`/quiz/${slug}/join`);
        }
    }, [sessionToken, slug, router]);

    // ─── Load contest ───────────────────────────────
    useEffect(() => {
        const load = async () => {
            const res = await contestService.getContestBySlug(slug);
            if (res.success && res.data) {
                setContest(res.data);
            }
            setLoading(false);
        };
        load();
    }, [slug, contestId]);

    // ─── Redirect to play, submitted, or disqualified screen based on status ───
    useEffect(() => {
        if (wsStatus === "submitted") {
            router.push(`/quiz/${slug}/submitted`);
        } else if (wsStatus === "disqualified") {
            router.push(`/quiz/${slug}/disqualified`);
        }
    }, [wsStatus, router, slug]);

    // ─── Trigger Starting Countdown ───
    useEffect(() => {
        if (wsStatus === "starting") {
            if (startCountdown === null) {
                setStartCountdown(5);
            }
        }
    }, [wsStatus, startCountdown]);

    // ─── Starting Countdown Ticker ───
    useEffect(() => {
        if (startCountdown === null) return;

        if (startCountdown <= 0) {
            router.push(`/quiz/${slug}/play`);
            return;
        }

        const timer = setTimeout(() => {
            setStartCountdown((prev) => (prev !== null ? prev - 1 : null));
        }, 1000);

        return () => clearTimeout(timer);
    }, [startCountdown, router, slug]);

    // ─── Require system check ─────────────────────
    useEffect(() => {
        const passed = sessionStorage.getItem(`system_check_${slug}`);
        if (!passed) {
            router.replace(`/quiz/${slug}/system-check`);
        }
    }, [slug, router]);

    // ─── Countdown timer + HTTP fallback when timer hits zero ─────────────────
    useEffect(() => {
        if (loading || !contest?.startTime) return;

        const target = contestStartTime ?? new Date(contest.startTime);
        if (Number.isNaN(target.getTime())) return;

        let pollInterval: ReturnType<typeof setInterval> | null = null;
        let redirected = false;

        const startPolling = () => {
            if (pollInterval || redirected) return;
            // Poll every 3s — if WS missed quiz:v1:start, redirect via REST fallback
            pollInterval = setInterval(async () => {
                try {
                    const res = await contestService.getContestBySlug(slug);
                    if (res.success && res.data?.status === 'LIVE' && !redirected) {
                        redirected = true;
                        clearInterval(pollInterval!);
                        router.push(`/quiz/${slug}/play`);
                    }
                } catch {
                    // ignore transient errors
                }
            }, 3000);
        };

        const tick = () => {
            const diffMs = target.getTime() - Date.now();
            if (diffMs <= 0) {
                setTimeToStart({ d: 0, h: 0, m: 0, s: 0 });
                // Timer hit zero but WS hasn't pushed quiz:v1:start yet — start polling
                startPolling();
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
        return () => {
            clearInterval(id);
            if (pollInterval) clearInterval(pollInterval);
        };
    }, [loading, contest, contestStartTime, slug, router]);

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
            <div className="min-h-screen flex items-center justify-center bg-[#0A0F1D] text-slate-100">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
                    <span className="text-sm font-medium text-slate-400 animate-pulse">Entering Waiting Room...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0A0F1D] text-slate-100 relative overflow-hidden flex flex-col justify-start">
            {/* Ambient background glows */}
            <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[130px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-violet-600/10 blur-[130px] pointer-events-none" />

            {/* ─── Top Bar ──────────────────────────────── */}
            <header className="fixed top-0 left-0 right-0 z-40 h-[56px] flex items-center justify-between px-4 sm:px-6 bg-slate-900/40 border-b border-slate-800/80 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Shield className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm font-bold text-white tracking-tight">QuizBuzz</span>
                </div>
                <WSConnectionStatus 
                    status={
                        wsStatus === "connected" || wsStatus === "starting"
                            ? "connected"
                            : wsStatus === "connecting"
                            ? "reconnecting"
                            : "disconnected"
                    } 
                    variant="compact" 
                />
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
                        style={{ background: "radial-gradient(circle at center, rgba(15, 23, 42, 0.98) 0%, rgba(10, 15, 29, 0.99) 100%)", backdropFilter: "blur(16px)" }}
                    >
                        <div className="text-center space-y-8 max-w-md px-6">
                            <motion.div
                                initial={{ scale: 0.5, rotate: -10 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", damping: 15 }}
                                className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center mx-auto shadow-2xl shadow-orange-500/30 border border-orange-400/30"
                            >
                                <Play className="w-8 h-8 text-white ml-1" fill="white" />
                            </motion.div>
                            
                            <div className="space-y-3">
                                <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-200 tracking-tight uppercase">
                                    Contest is Starting!
                               </h2>
                               <p className="text-slate-400 text-sm font-medium">
                                   Please do not close or refresh this tab.
                               </p>
                            </div>

                            {startCountdown !== null && (
                                <div className="h-40 flex items-center justify-center">
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={startCountdown}
                                            initial={{ opacity: 0, scale: 0.3, rotate: -15 }}
                                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                            exit={{ opacity: 0, scale: 1.5, rotate: 15 }}
                                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                                            className="text-8xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-400 to-orange-600 font-mono drop-shadow-[0_10px_20px_rgba(245,158,11,0.2)]"
                                        >
                                            {startCountdown > 0 ? startCountdown : "GO!"}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            )}

                            <div className="flex items-center justify-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider animate-pulse">
                                <Sparkles className="w-4 h-4" />
                                <span>Initializing Secure Environment...</span>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── Main Content ─────────────────────────── */}
            <WidgetErrorBoundary name="Waiting Room Details">
                <main className="flex flex-col items-center pt-24 sm:pt-32 pb-24 px-4 w-full max-w-4xl mx-auto z-10">
                    <div className="px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold uppercase tracking-wider mb-6 flex items-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                        Waiting Room
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-200 text-center max-w-2xl leading-tight mb-2 tracking-tight">
                        {contest?.title || "Quiz"}
                    </h1>

                    <p className="text-slate-400 text-sm mb-8 font-medium">Contest begins in</p>

                    <CountdownDisplay time={timeToStart} />

                    <div className="mt-8 flex items-center gap-2.5 bg-slate-900/60 border border-slate-800/80 px-4 py-2 rounded-full shadow-[0_2px_15px_rgba(0,0,0,0.1)] relative">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute left-4" />
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <motion.span
                            key={participantCount}
                            initial={{ opacity: 0.5, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm font-medium text-slate-300"
                        >
                            <strong className="text-emerald-400 font-semibold">{participantCount.toLocaleString()}</strong> participants in the waiting room
                        </motion.span>
                    </div>

                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
                        {/* Verified Details */}
                        <div className="backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 shadow-[0_0_60px_-15px_rgba(99,102,241,0.05)] rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-emerald-500/50 via-emerald-400/20 to-transparent" />
                            <div className="flex items-center gap-2.5 mb-5">
                                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                </div>
                                <span className="text-sm font-bold text-slate-200 uppercase tracking-wider">Verification Details</span>
                            </div>
                            <div className="space-y-4">
                                <InfoField label="Participant ID" value={participantId || "—"} mono />
                                <InfoField label="Contact Identifier" value={maskedContact} />
                                <InfoField label="Quiz Contest" value={contest?.title || "—"} />
                            </div>
                        </div>

                        {/* What to Expect / Rules */}
                        <div className="backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 shadow-[0_0_60px_-15px_rgba(99,102,241,0.05)] rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-indigo-500/50 via-indigo-400/20 to-transparent" />
                            <div className="flex items-center gap-2.5 mb-5">
                                <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                                    <Clock className="w-4 h-4 text-indigo-400" />
                                </div>
                                <span className="text-sm font-bold text-slate-200 uppercase tracking-wider">What to Expect</span>
                            </div>
                            <div className="space-y-4">
                                <InfoField label="Questions" value={`${contest?.totalQuestions || "—"} questions`} />
                                <InfoField label="Total Marks" value={`${contest?.totalMarks || "—"} marks`} />
                            </div>

                            <div className="mt-5 pt-4 border-t border-slate-800/80">
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Rules & Guidelines</p>
                                <div className="space-y-2">
                                    <div className="flex gap-2 text-sm text-slate-300">
                                        <span className="text-indigo-400 font-bold">•</span>
                                        <span>{rules[0]}</span>
                                    </div>
                                    {rules.length > 1 && (
                                        <>
                                            <AnimatePresence>
                                                {showAllRules && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden space-y-2"
                                                    >
                                                        {rules.slice(1).map((rule: string, i: number) => (
                                                             <div key={i} className="flex gap-2 text-sm text-slate-300">
                                                                 <span className="text-indigo-400 font-bold">•</span>
                                                                 <span>{rule}</span>
                                                             </div>
                                                         ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                            <button
                                                type="button"
                                                onClick={() => setShowAllRules(!showAllRules)}
                                                className="flex items-center gap-1 text-xs font-bold text-indigo-400 hover:text-indigo-300 mt-3 transition-colors"
                                            >
                                                {showAllRules ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                                {showAllRules ? "Show less" : `View all ${rules.length} rules`}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
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
        <div className="flex items-center gap-3 sm:gap-4 my-6">
            {units.map((unit, i) => (
                <div key={unit.label} className="flex items-center gap-3 sm:gap-4">
                    <div className="flex flex-col items-center">
                        <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl flex items-center justify-center border border-slate-800/80 bg-slate-900/50 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)] relative overflow-hidden group">
                            {/* Inner soft glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-50 pointer-events-none" />
                            <motion.span
                                key={`${unit.label}-${unit.value}`}
                                initial={{ y: 8, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="text-2xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-300 font-mono tracking-tight"
                            >
                                {String(unit.value).padStart(2, "0")}
                            </motion.span>
                        </div>
                        <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-2.5 font-bold">
                            {unit.label}
                        </span>
                    </div>

                    {i < units.length - 1 && (
                        <div className="text-slate-700 text-xl sm:text-3xl font-extrabold self-start mt-6 sm:mt-10 animate-pulse">:</div>
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
        info: "rgba(30,41,59,0.95)",
        warning: "rgba(120,53,4,0.95)",
        urgent: "rgba(153,27,27,0.95)",
    };

    const borderMap = {
        info: "border-blue-500/30 text-blue-400",
        warning: "border-amber-500/30 text-amber-400",
        urgent: "border-red-500/30 text-red-400",
    };

    const progressBarMap = {
        info: "bg-blue-500",
        warning: "bg-amber-500",
        urgent: "bg-red-500",
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
            className="fixed top-[56px] left-0 right-0 z-50 px-4 mt-2 max-w-2xl mx-auto"
        >
            <div
                className={`backdrop-blur-md rounded-xl border p-3 flex items-center gap-3 shadow-lg ${borderMap[message.type]}`}
                style={{ background: bgMap[message.type] }}
            >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm text-slate-100 flex-1">{message.text}</span>
                <button type="button" onClick={onDismiss} className="text-white/60 hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="h-[3px] rounded-b-xl overflow-hidden mt-[-3px] mx-[1px]" style={{ background: "rgba(255,255,255,0.05)" }}>
                <div className={`h-full transition-all duration-100 ${progressBarMap[message.type]}`} style={{ width: `${progress}%` }} />
            </div>
        </motion.div>
    );
}

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="bg-slate-950/30 border border-slate-800/40 rounded-xl p-3">
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold mb-1">{label}</p>
            <p className={`text-sm text-slate-200 font-medium ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</p>
        </div>
    );
}
