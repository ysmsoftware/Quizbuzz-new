"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
    ArrowLeft,
    Loader2,
    Shield,
    Smartphone,
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

    if (contestLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                    <span className="text-sm font-medium text-muted-foreground">Loading quiz workspace...</span>
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
        <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-background text-foreground">
            {/* Ambient Background Glows */}
            <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/10 blur-[130px] pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent/10 blur-[130px] pointer-events-none" />

            <motion.div 
                initial={{ opacity: 0, y: 15 }} 
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.4 }}
                className="w-full max-w-[460px] z-10"
            >
                <WidgetErrorBoundary name="Join Quiz Flow">
                    <div className="backdrop-blur-xl bg-card/40 border border-border/80 shadow-xl rounded-3xl overflow-hidden">
                        <div className="p-6 sm:p-10">
                            {/* Brand Header */}
                            <div className="text-center mb-8">
                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold tracking-wide uppercase mb-4">
                                    <Sparkles className="w-3.5 h-3.5" />
                                    <span>QUIZBUZZ LIVE</span>
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
                                    {contest?.title || "Join Quiz Workspace"}
                                </h1>
                                <p className="text-xs text-muted-foreground">
                                    Please enter your verified email address to register.
                                </p>
                            </div>

                            {/* Contest Info Badge */}
                            {contest && (
                                <div className="mb-6 p-4 rounded-2xl bg-muted/30 border border-border/60 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                                            <Shield className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-semibold text-foreground">Proctoring Level</div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {contest.proctoringEnabled ? "Automated Proctoring Enabled" : "Standard Browser Proctoring Only"}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-primary px-2.5 py-1 rounded-md bg-primary/10 border border-primary/10">
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
                                            <label className="text-xs font-semibold text-muted-foreground mb-2 block tracking-wider uppercase">Email Address</label>
                                            <div className="relative">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <Input
                                                    type="email"
                                                    placeholder="you@domain.com"
                                                    value={identifier}
                                                    onChange={(e) => setIdentifier(e.target.value)}
                                                    className="pl-11 h-12 bg-muted/40 border-border text-foreground placeholder-muted-foreground focus:border-primary focus:ring-primary/20 transition-all rounded-2xl"
                                                />
                                            </div>
                                        </div>
                                        {error && (
                                            <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-start gap-2.5 text-xs text-destructive">
                                                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                <span>{error}</span>
                                            </div>
                                        )}
                                        <Button
                                            onClick={handleProceedIdentify}
                                            disabled={!identifier.trim() || loading}
                                            className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-all border-none flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
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
                                            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" /> Back to Email
                                        </button>
                                        <div>
                                            <label className="text-xs font-semibold text-muted-foreground mb-2 block tracking-wider uppercase text-center">Contest Join Code</label>
                                            <Input
                                                type="text"
                                                placeholder="•••••"
                                                value={joinCode}
                                                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                                maxLength={5}
                                                className="h-14 text-center text-2xl font-bold tracking-[0.4em] uppercase bg-muted/40 border-border text-primary placeholder-muted-foreground/50 focus:border-primary focus:ring-primary/20 transition-all rounded-2xl"
                                            />
                                        </div>
                                        {error && (
                                            <div className="p-3.5 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-start gap-2.5 text-xs text-destructive">
                                                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                                <span>{error}</span>
                                            </div>
                                        )}
                                        <Button
                                            onClick={() => handleJoinContest()}
                                            disabled={joinCode.length < 5 || loading}
                                            className="w-full h-12 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold transition-all border-none flex items-center justify-center gap-2 shadow-lg shadow-primary/25"
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
                                            <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 animate-ping absolute" />
                                            <div className="w-16 h-16 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary relative">
                                                <Loader2 className="w-7 h-7 animate-spin" />
                                            </div>
                                        </div>
                                        <h2 className="font-bold text-lg text-foreground">Joining Quiz Room...</h2>
                                        <p className="text-xs text-muted-foreground mt-1">Configuring secure socket pipeline...</p>
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
                                                backgroundColor: i === currentDot ? "var(--primary)" : "var(--border)"
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
