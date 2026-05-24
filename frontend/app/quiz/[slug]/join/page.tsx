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
import { CameraCheckWidget } from "@/components/features/proctoring/CameraCheckWidget";
import { WidgetErrorBoundary } from "@/components/shared/WidgetErrorBoundary";
import type { Contest } from "@/lib/types";

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════
type Step = "IDENTIFY" | "OTP" | "CAMERA" | "REDIRECTING";
type InputMode = "phone" | "email";

const STEP_INDEX: Record<Step, number> = {
    IDENTIFY: 0,
    OTP: 1,
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
    const [inputMode, setInputMode] = useState<InputMode>("email"); // Default to email for QuizBuzz

    // Identity
    const [identifier, setIdentifier] = useState("");
    const [maskedIdentifier, setMaskedIdentifier] = useState("");
    const [countryCode] = useState("+91");

    // OTP
    const [otpValues, setOtpValues] = useState<string[]>(["", "", "", "", "", ""]);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
    const [joinCode, setJoinCode] = useState("");

    // Timers & state
    const [resendTimer, setResendTimer] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [errorCode, setErrorCode] = useState<string | null>(null);
    const [attemptsLeft, setAttemptsLeft] = useState(3);
    const [shakeOtp, setShakeOtp] = useState(false);

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
        if (resendTimer <= 0) return;
        const t = setInterval(() => setResendTimer((v) => Math.max(0, v - 1)), 1000);
        return () => clearInterval(t);
    }, [resendTimer]);

    useEffect(() => {
        if (step === "OTP") {
            setTimeout(() => otpRefs.current[0]?.focus(), 300);
        }
    }, [step]);

    useEffect(() => {
        if (step === "CAMERA") {
            requestCameraPermission();
        }
    }, [step, requestCameraPermission]);

    const getFullIdentifier = useCallback(() => {
        if (inputMode === "phone") return countryCode + identifier;
        return identifier;
    }, [inputMode, identifier, countryCode]);

    const handleSendOTP = async () => {
        if (!identifier.trim()) return;
        setLoading(true);
        setError(null);
        setErrorCode(null);

        try {
            // For slug-based join, we use the slug to identify the contest
            const res = await authService.sendOTP(getFullIdentifier(), inputMode, slug);
            if (res.success && res.data) {
                setMaskedIdentifier(res.data.maskedContact);
                setResendTimer(res.data.expiresIn || 60);
                setStep("OTP");
                setOtpValues(["", "", "", "", "", ""]);
            }
        } catch (err: any) {
            setErrorCode(err?.code || "UNKNOWN");
            setError(err?.message || "Could not send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (otpString?: string) => {
        if (loading) return;
        const otp = otpString || otpValues.join("");
        if (otp.length !== 6) return;

        setLoading(true);
        setError(null);

        try {
            const res = await authService.verifyOTP(getFullIdentifier(), inputMode, otp, slug, joinCode || undefined, contest?.id || undefined);
            if (res.success && res.data) {
                setSession({
                    sessionToken: res.data.sessionToken,
                    participantId: res.data.registration.participantId,
                    contestId: contest?.id || "",
                    identifier: getFullIdentifier(),
                    identifierType: inputMode,
                    deviceId: res.data.deviceId,
                });

                if (contest?.proctoringEnabled && contest?.webcamRequired) {
                    setStep("CAMERA");
                } else {
                    handleRedirect();
                }
            } else {
                handleOTPError(res.error || "UNKNOWN", res.message);
            }
        } catch (err: any) {
            handleOTPError(err?.code || "UNKNOWN", err?.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOTPError = (code: string, message?: string) => {
        if (code === "SESSION_CONFLICT") {
            setShowConflict(true);
            return;
        }
        setShakeOtp(true);
        setTimeout(() => setShakeOtp(false), 400);

        if (code === "INCORRECT_OTP" || code === "WRONG_OTP") {
            setAttemptsLeft((v) => Math.max(0, v - 1));
            setError(message || `Incorrect OTP. ${attemptsLeft - 1} attempts remaining.`);
            setOtpValues(["", "", "", "", "", ""]);
            setTimeout(() => otpRefs.current[0]?.focus(), 100);
        } else {
            setError(message || "Verification failed. Please try again.");
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

            // The real API returns startTime/endTime as full ISO 8601 timestamps.
            // Legacy mock fields (contestDate/contestStartTime/contestEndTime) are NOT present.
            const startTime = contest.startTime ? new Date(contest.startTime) : null;
            const endTime = contest.endTime ? new Date(contest.endTime) : null;

            if (!startTime || !endTime || isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
                // Fallback: if we can't parse times, go to system-check → waiting room
                router.push(`/quiz/${slug}/system-check`);
                return;
            }

            if (now < startTime) {
                // Quiz hasn't started yet → system-check → waiting room
                router.push(`/quiz/${slug}/system-check`);
            } else if (now >= startTime && now < endTime) {
                // Quiz is live → system-check (it will forward to waiting/play)
                router.push(`/quiz/${slug}/system-check`);
            } else {
                // Quiz has ended
                router.push(`/quiz/${slug}/submitted`);
            }
        }, 1500);
    };

    const handleOtpChange = (index: number, value: string) => {
        const digit = value.replace(/\D/g, "").slice(-1);
        const newValues = [...otpValues];
        newValues[index] = digit;
        setOtpValues(newValues);

        if (digit && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
        if (digit && index === 5 && newValues.join("").length === 6) {
            if (!contest?.joinCodeRequired) {
                handleVerifyOTP(newValues.join(""));
            }
        }
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

    const totalDots = contest?.proctoringEnabled && contest?.webcamRequired ? 3 : 2;
    const currentDot = STEP_INDEX[step];

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
                                        <div className="flex border-b mb-5">
                                            <button onClick={() => setInputMode("email")} className={`flex-1 py-2 text-sm font-medium border-b-2 ${inputMode === "email" ? "border-primary text-primary" : "border-transparent"}`}>Email</button>
                                            <button onClick={() => setInputMode("phone")} className={`flex-1 py-2 text-sm font-medium border-b-2 ${inputMode === "phone" ? "border-primary text-primary" : "border-transparent"}`}>Phone</button>
                                        </div>
                                        <Input
                                            type={inputMode === "email" ? "email" : "tel"}
                                            placeholder={inputMode === "email" ? "you@example.com" : "9876543210"}
                                            value={identifier}
                                            onChange={(e) => setIdentifier(e.target.value)}
                                            className="h-12 mb-4"
                                        />
                                        {error && <p className="text-sm text-destructive mb-4">{error}</p>}
                                        <Button onClick={handleSendOTP} disabled={!identifier.trim() || loading} className="w-full h-12 font-bold">
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send OTP"}
                                        </Button>
                                    </motion.div>
                                )}

                                {step === "OTP" && (
                                    <motion.div key="otp" variants={stepVariants} initial="enter" animate="center" exit="exit">
                                        <button onClick={() => setStep("IDENTIFY")} className="flex items-center gap-1 text-sm mb-4"><ArrowLeft className="w-4 h-4" /> Back</button>
                                        <div className="flex justify-center gap-2 mb-4">
                                            {otpValues.map((digit, i) => (
                                                <input
                                                    key={i}
                                                    ref={(el) => { otpRefs.current[i] = el; }}
                                                    maxLength={1}
                                                    value={digit}
                                                    onChange={(e) => handleOtpChange(i, e.target.value)}
                                                    className="w-12 h-14 text-center text-xl font-bold rounded-lg border-2"
                                                />
                                            ))}
                                        </div>
                                        {contest?.joinCodeRequired && (
                                            <div className="mb-4">
                                                <label className="text-sm font-medium mb-1.5 block text-muted-foreground">Join Code</label>
                                                <Input
                                                    type="text"
                                                    placeholder="Enter 5-character Join Code"
                                                    value={joinCode}
                                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                                    maxLength={5}
                                                    className="h-12 text-center text-lg font-semibold tracking-widest uppercase"
                                                />
                                            </div>
                                        )}
                                        {error && <p className="text-sm text-destructive text-center mb-4">{error}</p>}
                                        <Button 
                                            onClick={() => handleVerifyOTP()} 
                                            disabled={otpValues.join("").length < 6 || (contest?.joinCodeRequired && joinCode.length < 5) || loading} 
                                            className="w-full h-12 font-bold"
                                        >
                                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify"}
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

                            {step !== "REDIRECTING" && (
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
