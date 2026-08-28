"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
    const participantName = useAuthStore((s) => s.participantName) || "";
    const identifier = useAuthStore((s) => s.identifier) || "";
    const contestId = useAuthStore((s) => s.contestId) || "";

    // Contest data (HTTP)
    const [contest, setContest] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Server-clock offset (serverNow - clientNow), in ms. The contest starts on the
    // SERVER's schedule, so every countdown here is computed against server time.
    // Without this, a browser clock running even a minute fast/slow shows a
    // countdown that disagrees with reality — the classic symptom being the
    // participant getting pushed into the quiz while the timer still reads > 0.
    const [clockOffsetMs, setClockOffsetMs] = useState(0);
    const serverNow = useCallback(() => Date.now() + clockOffsetMs, [clockOffsetMs]);

    // Countdown
    const [timeToStart, setTimeToStart] = useState<TimeDiff>({ d: 0, h: 0, m: 0, s: 0 });
    const [showAllRules, setShowAllRules] = useState(false);
    const [startCountdown, setStartCountdown] = useState<number | null>(null);

    // These two coordinate the WS-driven "starting" countdown below with the
    // HTTP-polling fallback further down, so the two can't race each other
    // and cut the countdown short. See live-room audit, issue 4.
    const startCountdownActiveRef = useRef(false);
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // WS hook
    const {
        participantCount,
        wsStatus,
        broadcastMessage,
        clearBroadcast,
        showStartingOverlay,
        contestStartTime,
        rescheduledServerTime,
        cancellation,
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
            // `fresh` — must bypass ISR here: a cached response would carry a stale
            // serverTime (up to 60s off) and defeat the whole point of the offset.
            const requestedAt = Date.now();
            const res = await contestService.getContestBySlug(slug, { fresh: true });
            if (res.success && res.data) {
                setContest(res.data);

                if (res.data.serverTime) {
                    const serverMs = new Date(res.data.serverTime).getTime();
                    if (!Number.isNaN(serverMs)) {
                        // Compensate for round-trip: assume the server generated the
                        // timestamp roughly halfway through the request.
                        const rtt = Date.now() - requestedAt;
                        setClockOffsetMs(serverMs + rtt / 2 - Date.now());
                    }
                }
            }
            setLoading(false);
        };
        load();
    }, [slug, contestId]);

    // ─── Re-anchor the clock when a reschedule arrives mid-wait ───────────────
    useEffect(() => {
        if (!rescheduledServerTime) return;
        const serverMs = new Date(rescheduledServerTime).getTime();
        if (!Number.isNaN(serverMs)) {
            setClockOffsetMs(serverMs - Date.now());
        }
    }, [rescheduledServerTime]);

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
                setStartCountdown(3);
            }
            // The WS told us directly the quiz is live — the HTTP polling
            // fallback below exists only for "WS never told us"; stop it
            // immediately so it can't race this countdown and redirect early.
            startCountdownActiveRef.current = true;
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
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

        let redirected = false;

        const startPolling = () => {
            // Never start (or continue) polling once the WS-driven countdown has
            // taken over — it will complete the navigation on its own, and letting
            // this fallback keep running is exactly what cut the countdown short.
            if (startCountdownActiveRef.current || pollIntervalRef.current || redirected) return;
            // Poll every 3s — if WS missed quiz:v1:start, redirect via REST fallback.
            // `fresh` is required: the default ISR cache holds responses for 60s, which
            // would make this 3s poll return the same stale status over and over.
            pollIntervalRef.current = setInterval(async () => {
                if (startCountdownActiveRef.current) {
                    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                    return;
                }
                try {
                    const res = await contestService.getContestBySlug(slug, { fresh: true });
                    if (res.success && res.data?.status === 'LIVE' && !redirected && !startCountdownActiveRef.current) {
                        redirected = true;
                        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                        pollIntervalRef.current = null;
                        router.push(`/quiz/${slug}/play`);
                    }
                } catch {
                    // ignore transient errors
                }
            }, 3000);
        };

        const tick = () => {
            const diffMs = target.getTime() - serverNow();
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
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
            }
        };
    }, [loading, contest, contestStartTime, slug, router, serverNow]);

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
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    <span className="text-sm font-medium text-muted-foreground animate-pulse">Entering Waiting Room...</span>
                </div>
            </div>
        );
    }

    // Contest called off while this participant was waiting. Terminal — replaces the
    // room entirely rather than leaving a countdown ticking toward nothing.
    if (cancellation) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="w-20 h-20 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
                        <AlertTriangle className="w-10 h-10 text-destructive" />
                    </div>
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold">Contest Cancelled</h1>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            {contest?.title ? `“${contest.title}” has been cancelled by the organiser.` : "This contest has been cancelled by the organiser."}
                        </p>
                    </div>
                    <div className="bg-muted/40 border border-border rounded-2xl p-4 text-left">
                        <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Reason</p>
                        <p className="text-sm text-foreground">{cancellation.reason}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => router.push("/contests")}
                        className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-colors"
                    >
                        Browse other contests
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground relative overflow-hidden flex flex-col justify-start">
            {/* Ambient background glows */}
            <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[130px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-accent/10 blur-[130px] pointer-events-none" />

            {/* ─── Top Bar ──────────────────────────────── */}
            <header className="fixed top-0 left-0 right-0 z-40 h-[56px] flex items-center justify-between px-4 sm:px-6 bg-card/40 border-b border-border/80 backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                        <Shield className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <span className="text-sm font-bold text-foreground tracking-tight">QuizBuzz</span>
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
                        className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-2xl"
                    >
                        <div className="text-center space-y-8 max-w-md px-6">
                            <motion.div
                                initial={{ scale: 0.5, rotate: -10 }}
                                animate={{ scale: 1, rotate: 0 }}
                                transition={{ type: "spring", damping: 15 }}
                                className="w-20 h-20 rounded-3xl bg-warning flex items-center justify-center mx-auto shadow-2xl shadow-warning/30 border border-warning/30"
                            >
                                <Play className="w-8 h-8 text-warning-foreground ml-1" fill="currentColor" />
                            </motion.div>

                            <div className="space-y-3">
                                <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/70 tracking-tight uppercase">
                                    Contest is Starting!
                               </h2>
                               <p className="text-muted-foreground text-sm font-medium">
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
                                            className="text-8xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-warning to-warning/70 font-mono"
                                        >
                                            {startCountdown > 0 ? startCountdown : "GO!"}
                                        </motion.div>
                                    </AnimatePresence>
                                </div>
                            )}

                            <div className="flex items-center justify-center gap-2 text-primary text-xs font-semibold uppercase tracking-wider animate-pulse">
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
                    <div className="px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-6 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        Waiting Room
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/70 text-center max-w-2xl leading-tight mb-2 tracking-tight">
                        {contest?.title || "Quiz"}
                    </h1>

                    <p className="text-muted-foreground text-sm mb-4 font-medium">Contest begins in</p>

                    <CountdownDisplay time={timeToStart} />

                    <div className="mt-5 flex items-center gap-2.5 bg-card/60 border border-border/80 px-4 py-2 rounded-full shadow-sm relative">
                        <div className="w-2 h-2 rounded-full bg-success animate-ping absolute left-4" />
                        <div className="w-2 h-2 rounded-full bg-success" />
                        <motion.span
                            key={participantCount}
                            initial={{ opacity: 0.5, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm font-medium text-foreground"
                        >
                            <strong className="text-success font-semibold">{participantCount.toLocaleString()}</strong> participants in the waiting room
                        </motion.span>
                    </div>

                    <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full">
                        {/* Verified Details */}
                        <div className="backdrop-blur-xl bg-card/40 border border-border/80 rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-success/50 via-success/20 to-transparent" />
                            <div className="flex items-center gap-2.5 mb-5">
                                <div className="p-1.5 rounded-lg bg-success/10 border border-success/20">
                                    <CheckCircle2 className="w-4 h-4 text-success" />
                                </div>
                                <span className="text-sm font-bold text-foreground uppercase tracking-wider">Verification Details</span>
                            </div>
                            <div className="space-y-4">
                                <InfoField label="Participant" value={participantName || participantId || "—"} />
                                <InfoField label="Contact Identifier" value={maskedContact} />
                            </div>
                        </div>

                        {/* What to Expect / Rules */}
                        <div className="backdrop-blur-xl bg-card/40 border border-border/80 rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-primary/50 via-primary/20 to-transparent" />
                            <div className="flex items-center gap-2.5 mb-5">
                                <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                                    <Clock className="w-4 h-4 text-primary" />
                                </div>
                                <span className="text-sm font-bold text-foreground uppercase tracking-wider">What to Expect</span>
                            </div>
                            <div className="space-y-4">
                                <InfoField label="Questions" value={`${contest?.totalQuestions || "—"} questions`} />
                                <InfoField label="Duration" value={contest?.durationMinutes ? `${contest.durationMinutes} minutes` : "—"} />
                                <InfoField label="Total Marks" value={`${contest?.totalMarks || "—"} marks`} />
                            </div>

                            {/* Marking scheme — marks per correct answer, whether negative marking
                                applies (and by how much), and what happens to skipped questions.
                                Computed from the contest's totals rather than a literal per-question
                                field, since marks can vary per question but this is the common-case
                                uniform value admins configure. */}
                            <div className="mt-5 pt-4 border-t border-border/80">
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2">Marking Scheme</p>
                                <div className="space-y-2">
                                    <div className="flex gap-2 text-sm text-foreground/90">
                                        <span className="text-success font-bold">•</span>
                                        <span>
                                            {contest?.totalQuestions ? (
                                                <>
                                                    <strong>{(contest.totalMarks / contest.totalQuestions).toFixed(2).replace(/\.?0+$/, "")}</strong> marks for each correct answer
                                                </>
                                            ) : (
                                                "Marks are awarded for each correct answer"
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex gap-2 text-sm text-foreground/90">
                                        <span className={contest?.negativeMarking ? "text-destructive font-bold" : "text-success font-bold"}>•</span>
                                        <span>
                                            {contest?.negativeMarking ? (
                                                <>
                                                    Negative marking: <strong>−{contest?.negativeMarkValue ?? 0}</strong> marks for each wrong answer
                                                </>
                                            ) : (
                                                "No negative marking for wrong answers"
                                            )}
                                        </span>
                                    </div>
                                    <div className="flex gap-2 text-sm text-foreground/90">
                                        <span className="text-muted-foreground font-bold">•</span>
                                        <span>Skipped or unanswered questions are not awarded any marks</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-5 pt-4 border-t border-border/80">
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2">Rules & Guidelines</p>
                                <div className="space-y-2">
                                    <div className="flex gap-2 text-sm text-foreground/90">
                                        <span className="text-primary font-bold">•</span>
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
                                                             <div key={i} className="flex gap-2 text-sm text-foreground/90">
                                                                 <span className="text-primary font-bold">•</span>
                                                                 <span>{rule}</span>
                                                             </div>
                                                         ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                            <button
                                                type="button"
                                                onClick={() => setShowAllRules(!showAllRules)}
                                                className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 mt-3 transition-colors"
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
        <div className="flex items-center gap-3 sm:gap-4 mt-2 mb-3">
            {units.map((unit, i) => (
                <div key={unit.label} className="flex items-center gap-3 sm:gap-4">
                    <div className="flex flex-col items-center">
                        <div className="w-[4.5rem] h-[4.5rem] sm:w-28 sm:h-28 rounded-2xl flex items-center justify-center border border-border/80 bg-card/50 backdrop-blur-md shadow-sm relative overflow-hidden group">
                            {/* Inner soft glow */}
                            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-50 pointer-events-none" />
                            <motion.span
                                key={`${unit.label}-${unit.value}`}
                                initial={{ y: 8, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                                className="text-3xl sm:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-b from-foreground to-foreground/70 font-mono tracking-tight"
                            >
                                {String(unit.value).padStart(2, "0")}
                            </motion.span>
                        </div>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-2.5 font-bold">
                            {unit.label}
                        </span>
                    </div>

                    {i < units.length - 1 && (
                        <div className="text-muted-foreground/40 text-xl sm:text-3xl font-extrabold self-start mt-6 sm:mt-12 animate-pulse">:</div>
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
        info: "bg-card/95",
        warning: "bg-warning/15",
        urgent: "bg-destructive/15",
    };

    const borderMap = {
        info: "border-primary/30 text-primary",
        warning: "border-warning/40 text-warning",
        urgent: "border-destructive/40 text-destructive",
    };

    const progressBarMap = {
        info: "bg-primary",
        warning: "bg-warning",
        urgent: "bg-destructive",
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
                className={`backdrop-blur-md rounded-xl border p-3 flex items-center gap-3 shadow-lg ${bgMap[message.type]} ${borderMap[message.type]}`}
            >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm text-foreground flex-1">{message.text}</span>
                <button type="button" onClick={onDismiss} className="text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
            <div className="h-[3px] rounded-b-xl overflow-hidden mt-[-3px] mx-[1px] bg-border/20">
                <div className={`h-full transition-all duration-100 ${progressBarMap[message.type]}`} style={{ width: `${progress}%` }} />
            </div>
        </motion.div>
    );
}

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="bg-muted/30 border border-border/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-1">{label}</p>
            <p className={`text-sm text-foreground font-medium ${mono ? "font-mono text-xs break-all" : ""}`}>{value}</p>
        </div>
    );
}
