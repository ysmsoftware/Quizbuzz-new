"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Loader2,
    Shield,
    Monitor,
    Smartphone,
    AlertTriangle,
    Lock,
    CheckCircle,
    Video,
    Sparkles,
    Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/lib/services/auth-service";
import { contestService } from "@/lib/services/contest-service";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useProctoringStore } from "@/lib/stores/proctoring-store";
import { useQuizStore } from "@/lib/stores/quiz-store";
import { CameraCheckWidget } from "@/components/features/proctoring/CameraCheckWidget";
import { WidgetErrorBoundary } from "@/components/shared/WidgetErrorBoundary";
import type { Contest } from "@/lib/types";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════
type Step = "IDENTIFY" | "JOIN_CODE" | "CAMERA" | "REDIRECTING";

const STEP_INDEX: Record<Step, number> = {
    IDENTIFY: 0,
    JOIN_CODE: 1,
    CAMERA: 2,
    REDIRECTING: 2,
};

const stepVariants = {
    enter: { y: 15, opacity: 0 },
    center: { y: 0, opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { y: -15, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } },
} as const;

export default function QuizJoinPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params.slug as string;

    const [contest, setContest] = useState<any>(null);
    const [contestLoading, setContestLoading] = useState(true);

    const [step, setStep] = useState<Step>("IDENTIFY");
    const [identifier, setIdentifier] = useState("");
    const [joinCode, setJoinCode] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showConflict, setShowConflict] = useState(false);

    const requestCameraPermission = useProctoringStore((s) => s.requestCameraPermission);
    const setSession = useAuthStore((s) => s.setSession);

    // ─── Load contest ───────────────────────────────
    useEffect(() => {
        const loadContest = async () => {
            const res = await contestService.getContestBySlug(slug);
            if (res.success && res.data) {
                setContest(res.data);
            }
            setContestLoading(false);
        };
        loadContest();
    }, [slug]);

    useEffect(() => {
        if (step === "CAMERA") {
            requestCameraPermission();
        }
    }, [step, requestCameraPermission]);

    const handleJoinContest = async (codeToUse?: string) => {
        if (!identifier.trim()) return;
        setLoading(true);
        setError(null);

        try {
            const res = await authService.verifyOTP(
                identifier,
                "email",
                undefined,
                slug,
                codeToUse || joinCode || undefined,
                contest?.id || undefined
            );
            if (res.success && res.data) {
                setSession({
                    sessionToken: res.data.sessionToken,
                    participantId: res.data.registration.participantId,
                    contestId: contest?.id || "",
                    identifier: identifier,
                    identifierType: "email",
                    deviceId: res.data.deviceId,
                });

                const proctoringEnabledFromApi = res.data.proctoringEnabled ?? true;
                useQuizStore.getState().setProctoringEnabled(proctoringEnabledFromApi);

                if (contest?.proctoringEnabled && contest?.webcamRequired) {
                    setStep("CAMERA");
                } else {
                    handleRedirect();
                }
            } else {
                setError(res.message || "Failed to join quiz. Please try again.");
            }
        } catch (err: any) {
            setError(err?.message || "Failed to join quiz. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleProceedIdentify = async () => {
        if (!identifier.trim()) return;
        if (contest?.joinCodeRequired) {
            setStep("JOIN_CODE");
        } else {
            await handleJoinContest();
        }
    };

    const handleRedirect = () => {
        setStep("REDIRECTING");
        setTimeout(() => {
            if (!contest) {
                router.push(`/quiz/${slug}/system-check`);
                return;
            }
            const now = new Date();

            const startTime = contest.startTime ? new Date(contest.startTime) : null;
            const endTime = contest.endTime ? new Date(contest.endTime) : null;

            if (!startTime || !endTime || isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                router.push(`/quiz/${slug}/system-check`);
                return;
            }

            if (now < startTime) {
                router.push(`/quiz/${slug}/system-check`);
            } else if (now >= startTime && now < endTime) {
                router.push(`/quiz/${slug}/system-check`);
            } else {
                router.push(`/quiz/${slug}/submitted`);
            }
        }, 1500);
    };

    const handleForceSession = async () => {
        setLoading(true);
        try {
            const pId = useAuthStore.getState().participantId;
            if (pId) {
                await authService.forceSession(pId, contest?.id || slug);
            }
            setShowConflict(false);
            if (contest?.proctoringEnabled && contest?.webcamRequired) {
                setStep("CAMERA");
            } else {
                handleRedirect();
            }
        } catch {
            setError("Failed to take over session. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (contestLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#090D1A]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
                    <span className="text-sm font-medium text-slate-400">Loading quiz workspace...</span>
                </div>
            </div>
        );
    }

    const totalSteps: Step[] = ["IDENTIFY"];
    if (contest?.joinCodeRequired) totalSteps.push("JOIN_CODE");
    if (contest?.proctoringEnabled && contest?.webcamRequired) totalSteps.push("CAMERA");

    const totalDots = totalSteps.length;
    const currentDot = totalSteps.indexOf(step) === -1 ? totalSteps.length - 1 : totalSteps.indexOf(step);

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-[#0A0F1D] text-slate-100">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-violet-600/10 blur-[130px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[130px] pointer-events-none" />

            {showConflict && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md px-4">
                    <motion.div 
                        initial={{ scale: 0.95, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        className="bg-slate-900/90 border border-slate-800 rounded-3xl shadow-2xl p-6 max-w-sm w-full"
                    >
                        <div className="flex justify-center gap-4 mb-5">
                            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                                <Monitor className="w-6 h-6" />
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-rose-500">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                        </div>
                        <h3 className="text-lg font-bold text-center text-white mb-2">Session Conflict</h3>
                        <p className="text-sm text-slate-400 text-center mb-6 leading-relaxed">
                            You have an active quiz session on another device. Logging in here will close the other session.
                        </p>
                        <div className="flex gap-3">
                            <Button 
                                variant="outline" 
                                className="flex-1 rounded-xl border-slate-800 bg-slate-950/40 hover:bg-slate-800 text-slate-300"
                                onClick={() => setShowConflict(false)}
                            >
                                Cancel
                            </Button>
                            <Button 
                                variant="destructive" 
                                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                                onClick={handleForceSession} 
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue Here"}
                            </Button>
                        </div>
                    </motion.div>
                </div>
            )}

            <motion.div 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.4 }}
                className="w-full max-w-[460px] z-10"
            >
                <WidgetErrorBoundary name="Join Quiz Flow">
                    <div className="backdrop-blur-xl bg-slate-900/40 border border-slate-800/80 shadow-[0_0_50px_-12px_rgba(139,92,246,0.15)] rounded-3xl overflow-hidden">
                        <div className="p-6 sm:p-10">
                            {/* Brand Header */}
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-semibold tracking-wide uppercase mb-4">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>QUIZBUZZ LIVE</span>
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
                                    {contest?.title || "Join Quiz Workspace"}
                                </h1>
                                <p className="text-xs text-slate-400">
                                    Please enter your verified email address to register.
                                </p>
                            </div>

                            {/* Contest Info Badge */}
                            {contest && (
                                <div className="mb-6 p-4 rounded-2xl bg-slate-950/30 border border-slate-800/60 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                                            <Shield className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold text-slate-300">Proctoring Level</div>
                                            <div className="text-[10px] text-slate-500">
                                                {contest.proctoringEnabled ? "Automated Proctoring Enabled" : "Standard Browser Proctoring Only"}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-violet-400 px-2.5 py-1 rounded-md bg-violet-500/10 border border-violet-500/10">
                                        {contest.proctoringEnabled && contest.webcamRequired && (
                                            <>
                                                <Video className="w-3.5 h-3.5 mr-0.5" />
                                                Webcam Req
                                            </>
                                        )}
                                        {(!contest.proctoringEnabled || !contest.webcamRequired) && (
                                            <>
                                                <Lock className="w-3.5 h-3.5 mr-0.5" />
                                                Secure Room
                                            </>
                                        )}
                                    </div>
                                </div>
                            )}

                            <AnimatePresence mode="wait">
                                {step === "IDENTIFY" && (
                                    <motion.div 
                                        key="identify" 
                                        variants={stepVariants} 
                                        initial="enter" 
                                        animate="center" 
                                        exit="exit"
                                        className="space-y-4"
                                    >
                                        <div>
                                            <label className="text-xs font-semibold text-slate-400 mb-2 block tracking-wider uppercase">Email Address</label>
                                            <div className="relative">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                                <Input
                                                    type="email"
                                                    placeholder="you@domain.com"
                                                    value={identifier}
                                                    onChange={(e) => setIdentifier(e.target.value)}
                                                    className="pl-11 h-12 bg-slate-950/40 border-slate-800 text-white placeholder-slate-500 focus:border-violet-500 focus:ring-violet-500/20 transition-all rounded-2xl"
                                                />
                                            </div>
                                        </div>
                                        {error && (
                                            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-400">
                                                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                <span>{error}</span>
                                            </div>
                                        )}
                                        <Button 
                                            onClick={handleProceedIdentify} 
                                            disabled={!identifier.trim() || loading} 
                                            className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] text-white font-bold transition-all border-none flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(124,58,237,0.25)]"
                                        >
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continue to Verify"}
                                        </Button>
                                    </motion.div>
                                )}

                                {step === "JOIN_CODE" && (
                                    <motion.div 
                                        key="join_code" 
                                        variants={stepVariants} 
                                        initial="enter" 
                                        animate="center" 
                                        exit="exit"
                                        className="space-y-4"
                                    >
                                        <button 
                                            onClick={() => setStep("IDENTIFY")} 
                                            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" /> Back to Email
                                        </button>
                                        <div>
                                            <label className="text-xs font-semibold text-slate-400 mb-2 block tracking-wider uppercase text-center">Contest Join Code</label>
                                            <Input
                                                type="text"
                                                placeholder="•••••"
                                                value={joinCode}
                                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                                maxLength={5}
                                                className="h-14 text-center text-2xl font-bold tracking-[0.4em] uppercase bg-slate-950/40 border-slate-800 text-violet-400 placeholder-slate-700 focus:border-violet-500 focus:ring-violet-500/20 transition-all rounded-2xl"
                                            />
                                        </div>
                                        {error && (
                                            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2.5 text-xs text-rose-400">
                                                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                <span>{error}</span>
                                            </div>
                                        )}
                                        <Button 
                                            onClick={() => handleJoinContest()} 
                                            disabled={joinCode.length < 5 || loading} 
                                            className="w-full h-12 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 hover:shadow-[0_0_20px_rgba(124,58,237,0.4)] text-white font-bold transition-all border-none flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(124,58,237,0.25)]"
                                        >
                                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Connect"}
                                        </Button>
                                    </motion.div>
                                )}

                                {step === "CAMERA" && (
                                    <motion.div 
                                        key="camera" 
                                        variants={stepVariants} 
                                        initial="enter" 
                                        animate="center" 
                                        exit="exit"
                                    >
                                        <CameraCheckWidget onProceed={handleRedirect} onRetryCamera={requestCameraPermission} />
                                    </motion.div>
                                )}

                                {step === "REDIRECTING" && (
                                    <motion.div 
                                        key="redirecting" 
                                        className="text-center py-10 flex flex-col items-center justify-center"
                                    >
                                        <div className="relative mb-5 flex items-center justify-center">
                                            <div className="w-16 h-16 rounded-full bg-violet-600/10 border border-violet-500/20 animate-ping absolute" />
                                            <div className="w-16 h-16 rounded-full bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 relative">
                                                <Loader2 className="w-7 h-7 animate-spin" />
                                            </div>
                                        </div>
                                        <h2 className="font-bold text-lg text-white">Joining Quiz Room...</h2>
                                        <p className="text-xs text-slate-400 mt-1">Configuring secure socket pipeline...</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {step !== "REDIRECTING" && totalDots > 1 && (
                                <div className="flex justify-center gap-2 mt-8">
                                    {Array.from({ length: totalDots }).map((_, i) => (
                                        <motion.div 
                                            key={i} 
                                            animate={{
                                                width: i === currentDot ? 24 : 8,
                                                backgroundColor: i === currentDot ? "#8B5CF6" : "#1E293B"
                                            }}
                                            className="h-2 rounded-full" 
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </WidgetErrorBoundary>
            </motion.div>
        </div>
    );
}
