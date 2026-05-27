"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Send, ChevronRight, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Stores & Hooks
import { useQuizStore, type QuizQuestion } from "@/lib/stores/quiz-store";
import { useProctoringStore } from "@/lib/stores/proctoring-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useQuizSocket } from "@/lib/hooks/useQuizSocket";
import { useAnswerHandler } from "@/lib/hooks/useAnswerHandler";
import { useQuizTimer } from "@/lib/hooks/useQuizTimer";
import { WidgetErrorBoundary } from "@/components/shared/WidgetErrorBoundary";

// Components
import { ProctoringManager } from "@/components/features/proctoring/ProctoringManager";
import { FlaggedBanner } from "@/components/features/proctoring/ProctorWarningModal";
import { FullscreenReturnOverlay } from "@/components/features/proctoring/FullscreenReturnOverlay";
import { QuestionCard } from "@/components/features/quiz/QuestionCard";
import { OptionButton } from "@/components/features/quiz/OptionButton";
import { SubmitConfirmModal } from "@/components/features/quiz/SubmitConfirmModal";
import { AutoSubmitModal } from "@/components/features/quiz/AutoSubmitModal";
import { QuizLoadingScreen } from "@/components/features/quiz/QuizLoadingScreen";
import { QuizSubmittingScreen } from "@/components/features/quiz/QuizSubmittingScreen";

// Services
import { contestService } from "@/lib/services/contest-service";
import { submissionService } from "@/lib/services/submission-service";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

export default function QuizPlayPage() {
    const params = useParams();
    const router = useRouter();
    const slug = params.slug as string;

    const sessionToken = useAuthStore((s) => s.sessionToken) || "";
    const participantId = useAuthStore((s) => s.participantId) || "";
    const authContestId = useAuthStore((s) => s.contestId) || "";

    const videoRef = useRef<HTMLVideoElement>(null);
    const isFirstRender = useRef(true);
    const quizInitialisedRef = useRef(false);

    // Quiz store
    const questions = useQuizStore((s) => s.questions);
    const currentIndex = useQuizStore((s) => s.currentQuestionIndex);
    const answers = useQuizStore((s) => s.answers);
    const quizState = useQuizStore((s) => s.quizState);
    const setCurrentQuestion = useQuizStore((s) => s.setCurrentQuestion);
    const visitQuestion = useQuizStore((s) => s.visitQuestion);
    const setContestContext = useQuizStore((s) => s.setContestContext);

    const { isFullscreen, setFullscreen } = useProctoringStore();

    const [contest, setContest] = useState<any>(null);
    const [contestId, setContestId] = useState<string>(authContestId);
    const [showSubmitModal, setShowSubmitModal] = useState(false);
    const [showAutoSubmitModal, setShowAutoSubmitModal] = useState(false);

    // ─── Question-mapping helper ─────────────────────────────────────────────
    const applyQuizStartPayload = useCallback((data: any) => {
        if (quizInitialisedRef.current) return;
        quizInitialisedRef.current = true;

        let rawQuestions: any[] = [];
        if (Array.isArray(data)) {
            rawQuestions = data;
        } else if (data && Array.isArray(data.questions)) {
            rawQuestions = data.questions;
        } else if (data && typeof data === "object") {
            const numericKeys = Object.keys(data).filter(k => !isNaN(Number(k)));
            if (numericKeys.length > 0) {
                rawQuestions = numericKeys.sort((a, b) => Number(a) - Number(b)).map(k => data[k]);
            }
        }

        if (!rawQuestions.length) {
            console.warn("[QuizPlay] applyQuizStartPayload: no questions found", data);
            quizInitialisedRef.current = false;
            return;
        }

        const mappedQuestions = rawQuestions.map((q: any, idx: number): QuizQuestion => ({
            id: q.id,
            index: idx,
            text: q.questionText ?? q.text ?? "",
            imageUrl: q.imageUrl || undefined,
            difficulty: q.difficulty || "MEDIUM",
            hint: q.hint || undefined,
            marks: q.marks ?? 1,
            negativeMarks: q.negativeMark ?? q.negativeMarks ?? 0,
            options: (q.options || []).map((opt: any, optIdx: number) => ({
                id: opt.id,
                index: optIdx,
                text: opt.text,
                imageUrl: opt.imageUrl || undefined,
            })),
        }));

        const savedAnswers = data?.savedAnswers ?? {};
        const mappedAnswers: Record<number, number> = {};
        mappedQuestions.forEach((q: QuizQuestion) => {
            const saved = savedAnswers[q.id];
            if (saved?.selectedOptionId) {
                const option = q.options.find((opt: any) => opt.id === saved.selectedOptionId);
                if (option) mappedAnswers[q.index] = option.index;
            }
        });

        let remainingMs: number;
        if (typeof data?.remainingTimeMs === "number") {
            remainingMs = data.remainingTimeMs;
        } else if (typeof data?.totalTimeMs === "number" && data?.serverTimestamp) {
            const elapsed = Date.now() - new Date(data.serverTimestamp).getTime();
            remainingMs = Math.max(0, data.totalTimeMs - elapsed);
        } else {
            remainingMs = 0;
        }

        useQuizStore.setState({
            questions: mappedQuestions,
            answers: mappedAnswers,
            currentQuestionIndex: data?.currentQuestionIndex ?? 0,
            timeRemaining: remainingMs > 0
                ? Math.floor(remainingMs / 1000)
                : useQuizStore.getState().timeRemaining,
            quizState: "ACTIVE",
            visitedQuestions: Object.keys(mappedAnswers).map(Number),
        });

        console.log(`[QuizPlay] Initialised: ${mappedQuestions.length} questions`);
    }, []);

    // Zustand hydration guard
    useEffect(() => {
        const unsub = useQuizStore.persist.onFinishHydration((state) => {
            if ((state as any).questions?.length === 0) {
                quizInitialisedRef.current = false;
                try {
                    const raw = sessionStorage.getItem("quizStartPayload");
                    if (raw) applyQuizStartPayload(JSON.parse(raw));
                } catch { /* ignore */ }
            }
        });
        return () => unsub();
    }, [applyQuizStartPayload]);

    // Step 1: Read from sessionStorage on mount
    useEffect(() => {
        if (quizInitialisedRef.current) return;
        try {
            const raw = sessionStorage.getItem("quizStartPayload");
            if (raw) applyQuizStartPayload(JSON.parse(raw));
        } catch { /* ignore */ }
    }, [applyQuizStartPayload]);

    // Step 2: Fetch contest metadata in parallel
    useEffect(() => {
        contestService.getContestBySlug(slug).then((res) => {
            if (res.success && res.data) {
                setContest(res.data);
                setContestContext(res.data.title, res.data.slug, res.data.id, participantId);
                if (!authContestId && res.data.id) setContestId(res.data.id);
            }
        });
        visitQuestion(0);
    }, [slug, participantId, authContestId, setContestContext, visitQuestion]);

    // ─── WebSocket ───────────────────────────────────────────────────────────
    const {
        submitAnswer: emitAnswer,
        submitQuiz: emitSubmit,
        sendProctoringEvent,
        isConnected,
        socket,
    } = useQuizSocket({
        contestId,
        participantId,
        socketToken: sessionToken,
        onJoinAck: (data) => {
            if (data.status === "SUBMITTED") { router.push(`/quiz/${slug}/submitted`); return; }
            if (data.status === "DISQUALIFIED") { router.push(`/quiz/${slug}/disqualified`); return; }
            if (data.status === "WAITING") {
                toast.info("Reconnecting to your quiz session...", { id: "quiz-reconnect" });
            }
        },
        onQuizStarted: (data) => {
            quizInitialisedRef.current = false;
            applyQuizStartPayload(data);
            toast.success(
                data.savedAnswers && Object.keys(data.savedAnswers).length > 0
                    ? "Welcome back! Restored your progress."
                    : "Quiz started!"
            );
        },
        onSubmitAck: () => {
            toast.success("Quiz submitted successfully!");
            useQuizStore.getState().resetQuiz();
            router.push(`/quiz/${slug}/submitted`);
        },
        onAutoSubmit: () => {
            toast.info("Time is up! Your quiz was automatically submitted.");
            useQuizStore.getState().resetQuiz();
            router.push(`/quiz/${slug}/submitted?reason=timeout`);
        },
        onDisqualified: () => {
            toast.error("You have been disqualified from this contest.");
            useQuizStore.getState().resetQuiz();
            router.push(`/quiz/${slug}/disqualified`);
        },
    });

    // ─── Proctoring warnings → toast (side position) ─────────────────────────
    const emitProctoringWarning = useCallback((type: string) => {
        sendProctoringEvent(type, 1);
        const msgs: Record<string, string> = {
            TAB_SWITCH: "You left the quiz window!",
            FULLSCREEN_EXIT: "Fullscreen exited!",
            MULTIPLE_FACES: "Multiple faces detected!",
            NO_FACE: "No face detected — please stay in frame.",
            AUDIO_ANOMALY: "High background noise detected.",
        };
        toast.warning(msgs[type] ?? "Unusual activity detected.", {
            position: "top-right",
            duration: 4000,
            id: `proc-${type}`,
        });
    }, [sendProctoringEvent]);

    // Connection status toasts
    useEffect(() => {
        if (isFirstRender.current) { isFirstRender.current = false; return; }
        if (!isConnected) {
            toast.error("Connection lost — reconnecting. Your answers are safe.", {
                duration: 5000,
                id: "socket-status",
                position: "top-right",
            });
        } else {
            toast.success("Connected.", { duration: 2000, id: "socket-status", position: "top-right" });
        }
    }, [isConnected]);

    // ─── Answer Handler ────────────────────────────────────────────────────
    const { handleAnswer, confirmAnswer } = useAnswerHandler((qId, optId, optText) => {
        emitAnswer(qId, optId ?? "", optText, new Date().toISOString());
    });

    // ─── Timer ────────────────────────────────────────────────────────────
    const { timeRemaining } = useQuizTimer(
        () => setShowAutoSubmitModal(true),
        () => { }
    );

    // ─── Navigation ───────────────────────────────────────────────────────
    // Next: confirm current answer → move forward
    const handleNext = useCallback(() => {
        if (currentIndex < questions.length - 1) {
            confirmAnswer(currentIndex);
            const next = currentIndex + 1;
            setCurrentQuestion(next);
            visitQuestion(next);
        }
    }, [currentIndex, questions.length, confirmAnswer, setCurrentQuestion, visitQuestion]);

    // Skip: emit null for current question → move forward
    const handleSkip = useCallback(() => {
        if (currentIndex < questions.length - 1) {
            // Always emit a null answer so the backend tracks the skip
            const question = questions[currentIndex];
            if (question) emitAnswer(question.id, "", "", new Date().toISOString());
            const next = currentIndex + 1;
            setCurrentQuestion(next);
            visitQuestion(next);
        }
    }, [currentIndex, questions, questions.length, emitAnswer, setCurrentQuestion, visitQuestion]);

    const handleReturnFullscreen = async () => {
        try {
            await document.documentElement.requestFullscreen();
            setFullscreen(true);
        } catch { /* ignore */ }
    };

    // ─── Submission ────────────────────────────────────────────────────────
    const handleSubmission = useCallback(async (reason: "MANUAL" | "AUTO") => {
        useQuizStore.setState({ quizState: "SUBMITTING" });
        const toastId = toast.loading("Submitting your quiz...");

        try {
            if (typeof window !== "undefined" && (window as any).__triggerProctoringCapture) {
                await (window as any).__triggerProctoringCapture("SNAPSHOT_PRE_SUBMIT");
            }
        } catch { /* ignore */ }

        try {
            // Always confirm the currently visible question first
            confirmAnswer(currentIndex);

            const answersRecord: Record<string, string> = {};
            Object.entries(answers).forEach(([qIdxStr, optIdx]) => {
                const question = questions[parseInt(qIdxStr)];
                if (question) {
                    const opt = question.options.find(o => o.index === optIdx);
                    if (opt) answersRecord[question.id] = opt.id || String(opt.index);
                }
            });

            const timeTaken = contest?.durationMinutes
                ? contest.durationMinutes * 60 - timeRemaining
                : 0;

            if (isConnected) {
                emitSubmit(answersRecord, timeTaken);
                await new Promise(resolve => setTimeout(resolve, 4000));
                if (useQuizStore.getState().quizState !== "SUBMITTING") {
                    toast.dismiss(toastId);
                    return;
                }
            }

            // REST fallback
            toast.loading("Finalising submission...", { id: toastId });
            const answersList = Object.entries(answersRecord).map(([qId, optId]) => ({
                questionId: qId,
                selectedOptionId: optId,
                answeredAt: new Date().toISOString(),
            }));
            const res = await submissionService.submitQuizREST(
                contest?.id || slug,
                participantId,
                answersList,
                sessionToken,
            );

            if (res.success) {
                toast.success("Submitted!", { id: toastId });
                useQuizStore.setState({ quizState: "IDLE" });
                router.push(`/quiz/${slug}/submitted${reason === "AUTO" ? "?reason=timeout" : ""}`);
            } else {
                toast.error(res.error || "Submission failed. Please retry.", { id: toastId });
                useQuizStore.setState({ quizState: "ACTIVE" });
            }
        } catch (err) {
            console.error("Submission error:", err);
            toast.error("Submission failed. Check your connection and retry.", { id: toastId });
            useQuizStore.setState({ quizState: "ACTIVE" });
        }
    }, [isConnected, emitSubmit, confirmAnswer, answers, questions, currentIndex, contest, timeRemaining, slug, participantId, sessionToken, router]);

    const handleManualSubmit = () => handleSubmission("MANUAL");
    const handleAutoSubmit = () => handleSubmission("AUTO");

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return h > 0
            ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
            : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    };

    // ─── Guards ───────────────────────────────────────────────────────────
    if (quizState === "LOADING" || quizState === "IDLE" || questions.length === 0) {
        return <QuizLoadingScreen />;
    }
    if (quizState === "SUBMITTING") {
        return <QuizSubmittingScreen />;
    }

    const currentQuestion = questions[currentIndex];
    const isLastQuestion = currentIndex === questions.length - 1;
    const hasAnswer = answers[currentIndex] !== undefined;
    // Progress: questions confirmed so far = currentIndex (each Next locks one in)
    const progressPct = Math.round((currentIndex / questions.length) * 100);

    return (
        <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-950 text-white">
            {/* Proctoring Engine — invisible, no DOM output */}
            <ProctoringManager
                emitProctoringWarning={emitProctoringWarning}
                videoRef={videoRef}
                socket={socket}
                contestId={contest?.id || slug}
                participantId={participantId}
                sessionToken={sessionToken}
            />

            {/* Overlays & modals */}
            <FlaggedBanner />
            <FullscreenReturnOverlay isVisible={!isFullscreen} onReturn={handleReturnFullscreen} />
            <SubmitConfirmModal
                isOpen={showSubmitModal}
                onClose={() => setShowSubmitModal(false)}
                onConfirm={handleManualSubmit}
            />
            <AutoSubmitModal open={showAutoSubmitModal} onAutoSubmit={handleAutoSubmit} />

            {/* ── Header ──────────────────────────────────────────────────────── */}
            <header className="flex-none h-16 flex items-center justify-between px-4 md:px-8 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl z-40">
                {/* Contest title */}
                <div className="min-w-0 flex-1 mr-4">
                    <p className="text-xs text-white/40 uppercase tracking-widest font-semibold truncate">
                        {contest?.title || "Quiz"}
                    </p>
                </div>

                {/* Timer */}
                <div className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-xl border tabular-nums transition-all duration-300 flex-none",
                    timeRemaining < 300
                        ? "bg-red-500/10 border-red-500/30 text-red-400 animate-pulse"
                        : "bg-white/5 border-white/10 text-white",
                )}>
                    <Clock className="h-4 w-4 shrink-0 text-orange-500" />
                    <span className="font-mono text-lg font-bold">{formatTime(timeRemaining)}</span>
                </div>

                {/* Submit */}
                <Button
                    className="ml-3 rounded-xl font-bold px-4 h-9 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 border border-orange-400/20 shadow-lg shadow-orange-500/10 flex-none text-sm"
                    onClick={() => setShowSubmitModal(true)}
                >
                    <Send className="h-4 w-4 mr-1.5" />
                    <span>Submit</span>
                </Button>
            </header>

            {/* ── Progress bar + question counter ─────────────────────────────── */}
            <div className="flex-none px-4 md:px-8 pt-3 pb-2 bg-slate-950">
                <div className="max-w-2xl mx-auto">
                    <div className="flex items-center justify-between text-xs text-white/40 font-medium mb-1">
                        <span>Question {currentIndex + 1} of {questions.length}</span>
                        <span>{progressPct}% done</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                            initial={false}
                            animate={{ width: `${progressPct}%` }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                        />
                    </div>
                </div>
            </div>

            {/* ── Main container ─────────────────────────────────────────────────── */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
                <WidgetErrorBoundary name="Question Player">
                    <main className="flex-1 overflow-y-auto px-4 md:px-8 py-4">
                        <div className="max-w-2xl mx-auto flex flex-col gap-6">
                            
                            {/* Widescreen Proctoring Camera Feed */}
                            <div className="w-full max-w-md mx-auto">
                                <div className="relative aspect-[21/9] sm:aspect-[24/9] rounded-2xl overflow-hidden bg-slate-900/60 border border-slate-800 shadow-2xl backdrop-blur-md group">
                                    <video
                                        ref={videoRef}
                                        autoPlay playsInline muted
                                        className="w-full h-full object-cover scale-x-[-1] brightness-[0.85] contrast-[1.05] group-hover:brightness-100 transition-all duration-300"
                                    />
                                    
                                    {/* Top overlays */}
                                    <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-950/70 border border-white/5 backdrop-blur-md text-[9px] uppercase tracking-wider font-extrabold text-white/90">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping absolute" />
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                        <span>LIVE</span>
                                    </div>
                                    
                                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-950/70 border border-white/5 backdrop-blur-md text-[9px] uppercase tracking-wider font-extrabold text-orange-400">
                                        <span>PROCTOR ACTIVE</span>
                                    </div>
                                    
                                    {/* Ambient HUD decorative grid lines */}
                                    <div className="absolute inset-0 pointer-events-none border border-white/5 rounded-2xl" />
                                    <div className="absolute bottom-2 left-2 text-[9px] font-mono text-white/40">
                                        CAM_01 // SECURE_CONTEST
                                    </div>
                                </div>
                            </div>

                            {/* Animated Question & Option Cards */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={currentIndex}
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -15 }}
                                    transition={{ duration: 0.22, ease: "easeOut" }}
                                    className="flex flex-col gap-6"
                                >
                                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-5 md:p-6 shadow-xl backdrop-blur-sm">
                                        <QuestionCard question={currentQuestion} questionNumber={currentIndex + 1} />
                                    </div>

                                    <div className="grid gap-3">
                                        {currentQuestion.options.map((option, i) => (
                                            <OptionButton
                                                key={option.index}
                                                option={option}
                                                optionLabel={OPTION_LABELS[i] ?? String(i)}
                                                isSelected={answers[currentIndex] === option.index}
                                                onClick={() => handleAnswer(currentIndex, option.index)}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </main>

                    {/* ── Bottom navigation bar stuck at screen bottom ───────────────── */}
                    <footer className="flex-none border-t border-white/5 bg-slate-950/90 backdrop-blur-xl py-4 px-4 sm:px-8 z-40">
                        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
                            {isLastQuestion ? (
                                /* Last question — Submit button only, styled full-width on mobile */
                                <Button
                                    size="lg"
                                    className="w-full sm:w-auto sm:ml-auto rounded-2xl h-12 px-8 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0 font-bold gap-2 shadow-lg shadow-orange-500/20 text-base"
                                    onClick={() => setShowSubmitModal(true)}
                                >
                                    <Send className="h-4 w-4" />
                                    Submit Quiz
                                </Button>
                            ) : (
                                <>
                                    {/* Skip: move forward without answering */}
                                    <Button
                                        size="lg"
                                        variant="ghost"
                                        className="rounded-2xl h-12 px-6 text-white/50 hover:text-white hover:bg-white/5 gap-2 border border-white/10 hover:border-white/20 text-sm"
                                        onClick={handleSkip}
                                    >
                                        <SkipForward className="h-4 w-4" />
                                        <span>Skip</span>
                                    </Button>

                                    {/* Next: confirm answer + move forward */}
                                    <Button
                                        size="lg"
                                        className={cn(
                                            "flex-1 sm:flex-initial rounded-2xl h-12 px-10 font-bold gap-2 border-0 transition-all text-base",
                                            hasAnswer
                                                ? "bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/20"
                                                : "bg-white/10 hover:bg-white/15 text-white",
                                        )}
                                        onClick={handleNext}
                                    >
                                        <span>Next</span>
                                        <ChevronRight className="h-5 w-5" />
                                    </Button>
                                </>
                            )}
                        </div>
                    </footer>
                </WidgetErrorBoundary>
            </div>
        </div>
    );
}
