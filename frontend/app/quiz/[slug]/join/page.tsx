"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Loader2,
    Phone,
    Mail,
    Shield,
    Monitor,
    Smartphone,
    AlertTriangle,
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
    enter: { x: 24, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -24, opacity: 0 },
};

export default function QuizJoinPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params.slug as string;

    // Contest data — uses 'any' because this page accesses quiz-specific fields
    // that aren't on PublicContestDetail (proctoringEnabled, webcamRequired, etc.)
    const [contest, setContest] = useState<any>(null);
    const [contestLoading, setContestLoading] = useState(true);

    // Step machine
    const [step, setStep] = useState<Step>("IDENTIFY");

    // Identity
    const [identifier, setIdentifier] = useState("");

    // Join Code
    const [joinCode, setJoinCode] = useState("");

    // State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Device conflict
    const [showConflict, setShowConflict] = useState(false);

    // Proctoring store
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

                // Save per-contest proctoring flag in quiz store so system-check
                // and play pages can read it across navigation boundaries.
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
            // Always route through system-check — proctoringEnabled=false only
            // means "no camera module" (handled inside that page itself), not
            // "skip validation". Fullscreen capability, network connectivity,
            // and browser validity must still be verified for every contest.
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
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <Loader2 className="w-8 h-8 text-white/60 animate-spin" />
            </div>
        );
    }

    const totalSteps: Step[] = ["IDENTIFY"];
    if (contest?.joinCodeRequired) totalSteps.push("JOIN_CODE");
    if (contest?.proctoringEnabled && contest?.webcamRequired) totalSteps.push("CAMERA");

    const totalDots = totalSteps.length;
    const currentDot = totalSteps.indexOf(step) === -1 ? totalSteps.length - 1 : totalSteps.indexOf(step);

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "linear-gradient(135deg, #0F2040 0%, #0D1117 100%)" }}>
            {showConflict && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-card rounded-2xl shadow-2xl border p-6 max-w-sm w-full mx-4">
                        <div className="flex justify-center gap-4 mb-4">
                            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center"><Monitor className="w-6 h-6" /></div>
                            <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center"><Smartphone className="w-6 h-6" /></div>
                        </div>
                        <h3 className="text-lg font-bold text-center mb-2">Already active on another device</h3>
                        <p className="text-sm text-muted-foreground text-center mb-3">You have an active session elsewhere. Continuing here will close it.</p>
                        <div className="flex gap-3">
                            <Button variant="outline" className="flex-1" onClick={() => setShowConflict(false)}>Cancel</Button>
                            <Button variant="destructive" className="flex-1" onClick={handleForceSession} disabled={loading}>Continue Here</Button>
                        </div>
                    </motion.div>
                </div>
            )}

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-[480px]">
                <WidgetErrorBoundary name="Join Quiz Flow">
                    <div className="bg-background rounded-2xl shadow-2xl overflow-hidden border">
                        <div className="px-6 pt-8 pb-6 sm:px-10 sm:pt-10 sm:pb-8">
                            <div className="text-center mb-6">
                                <div className="inline-flex items-center gap-2 mb-3">
                                    <Shield className="w-4 h-4 text-primary" />
                                    <span className="text-sm font-semibold text-muted-foreground">QuizBuzz Pro</span>
                                </div>
                                <h1 className="text-xl font-bold">{contest?.title || "Quiz Join"}</h1>
                            </div>

                            <AnimatePresence mode="wait">
                                {step === "IDENTIFY" && (
                                    <motion.div key="identify" variants={stepVariants} initial="enter" animate="center" exit="exit">
                                        <div className="mb-5">
                                            <label className="text-sm font-semibold mb-2 block text-muted-foreground">Email Address</label>
                                            <Input
                                                type="email"
                                                placeholder="you@example.com"
                                                value={identifier}
                                                onChange={(e) => setIdentifier(e.target.value)}
                                                className="h-12 mb-4"
                                            />
                                        </div>
                                        {error && <p className="text-sm text-destructive mb-4">{error}</p>}
                                        <Button onClick={handleProceedIdentify} disabled={!identifier.trim() || loading} className="w-full h-12 font-bold">
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Continue"}
                                        </Button>
                                    </motion.div>
                                )}

                                {step === "JOIN_CODE" && (
                                    <motion.div key="join_code" variants={stepVariants} initial="enter" animate="center" exit="exit">
                                        <button onClick={() => setStep("IDENTIFY")} className="flex items-center gap-1 text-sm mb-4 text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-4 h-4" /> Back</button>
                                        <div className="mb-6">
                                            <label className="text-sm font-semibold mb-2 block text-muted-foreground">Join Code</label>
                                            <Input
                                                type="text"
                                                placeholder="Enter 5-character Join Code"
                                                value={joinCode}
                                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                                maxLength={5}
                                                className="h-12 text-center text-lg font-semibold tracking-widest uppercase mb-4"
                                            />
                                        </div>
                                        {error && <p className="text-sm text-destructive text-center mb-4">{error}</p>}
                                        <Button 
                                            onClick={() => handleJoinContest()} 
                                            disabled={joinCode.length < 5 || loading} 
                                            className="w-full h-12 font-bold"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Join"}
                                        </Button>
                                    </motion.div>
                                )}

                                {step === "CAMERA" && (
                                    <motion.div key="camera" variants={stepVariants} initial="enter" animate="center" exit="exit">
                                        <CameraCheckWidget onProceed={handleRedirect} onRetryCamera={requestCameraPermission} />
                                    </motion.div>
                                )}

                                {step === "REDIRECTING" && (
                                    <motion.div key="redirecting" className="text-center py-12">
                                        <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" />
                                        <h2 className="font-bold">Joining quiz...</h2>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {step !== "REDIRECTING" && totalDots > 1 && (
                                <div className="flex justify-center gap-2 mt-6">
                                    {Array.from({ length: totalDots }).map((_, i) => (
                                        <div key={i} className={`w-2 h-2 rounded-full ${i <= currentDot ? "bg-primary" : "bg-border"}`} />
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
