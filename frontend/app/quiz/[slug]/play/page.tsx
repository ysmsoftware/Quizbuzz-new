"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Menu, 
  X, 
  LayoutGrid, 
  Shield, 
  Info, 
  Clock, 
  Send,
  ChevronLeft,
  ChevronRight,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Stores & Hooks
import { useQuizStore } from "@/lib/stores/quiz-store";
import { useProctoringStore } from "@/lib/stores/proctoring-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useQuizSocket } from "@/lib/hooks/useQuizSocket";
import { useAnswerHandler } from "@/lib/hooks/useAnswerHandler";
import { useQuizTimer } from "@/lib/hooks/useQuizTimer";
import { WidgetErrorBoundary } from "@/components/shared/WidgetErrorBoundary";

// Components
import { ProctoringManager } from "@/components/features/proctoring/ProctoringManager";
import { ProctorWarningModal, type WarningType, FlaggedBanner } from "@/components/features/proctoring/ProctorWarningModal";
import { FullscreenReturnOverlay } from "@/components/features/proctoring/FullscreenReturnOverlay";
import { QuestionCard } from "@/components/features/quiz/QuestionCard";
import { OptionButton } from "@/components/features/quiz/OptionButton";
import { SubmitConfirmModal } from "@/components/features/quiz/SubmitConfirmModal";
import { AutoSubmitModal } from "@/components/features/quiz/AutoSubmitModal";
import { QuizLoadingScreen } from "@/components/features/quiz/QuizLoadingScreen";
import { QuizSubmittingScreen } from "@/components/features/quiz/QuizSubmittingScreen";
import { ProctoringRightPanel } from "@/components/features/proctoring/ProctoringRightPanel";

// Services
import { contestService } from "@/lib/services/contest-service";
import type { Contest } from "@/lib/types";

const OPTION_LABELS = ["A", "B", "C", "D", "E", "F"];

export default function QuizPlayPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  // Auth
  const sessionToken = useAuthStore((s) => s.sessionToken) || "";
  const participantId = useAuthStore((s) => s.participantId) || "";

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);

  // Quiz store
  const questions = useQuizStore((s) => s.questions);
  const currentIndex = useQuizStore((s) => s.currentQuestionIndex);
  const answers = useQuizStore((s) => s.answers);
  const quizState = useQuizStore((s) => s.quizState);
  const setCurrentQuestion = useQuizStore((s) => s.setCurrentQuestion);
  const visitQuestion = useQuizStore((s) => s.visitQuestion);
  const setContestContext = useQuizStore((s) => s.setContestContext);

  // Proctoring store
  const { isFullscreen, setFullscreen, totalWarnings, maxTabSwitches } = useProctoringStore();

  // Local state
  const [contest, setContest] = useState<Contest | null>(null);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showAutoSubmitModal, setShowAutoSubmitModal] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [warningModal, setWarningModal] = useState<{ open: boolean; type: WarningType }>({ open: false, type: "TAB_SWITCH" });

  // ─── WS Connection ─────────────────────────────
  const { emitAnswer, emitSubmit, emitProctoringWarning, isConnected } = useQuizSocket(
    contest?.id || slug,
    participantId,
    sessionToken
  );

  // ─── Answer Handler ────────────────────────────
  const { handleAnswer } = useAnswerHandler(emitAnswer);

  // ─── Timer Hook ────────────────────────────────
  const { timeRemaining } = useQuizTimer(
    () => setShowAutoSubmitModal(true),
    () => { /* warning */ }
  );

  // ─── Navigation ────────────────────────────────
  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) setCurrentQuestion(currentIndex - 1);
  }, [currentIndex, setCurrentQuestion]);

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      const next = currentIndex + 1;
      setCurrentQuestion(next);
      visitQuestion(next);
    }
  }, [currentIndex, questions.length, setCurrentQuestion, visitQuestion]);

  // ─── Init on mount ─────────────────────────────
  useEffect(() => {
    contestService.getContestBySlug(slug).then((res) => {
      if (res.success && res.data) {
        setContest(res.data);
        setContestContext(res.data.title, res.data.slug, res.data.id, participantId);
      }
    });
    visitQuestion(0);
  }, [slug, participantId, setContestContext, visitQuestion]);

  // ─── Proctoring handlers ───────────────────────
  const handleReturnFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
      setFullscreen(true);
    } catch { /* ignore */ }
  };

  const handleManualSubmit = () => {
    emitSubmit("MANUAL");
    router.push(`/quiz/${slug}/submitted`);
  };
  const handleAutoSubmit = () => {
    emitSubmit("AUTO");
    router.push(`/quiz/${slug}/submitted?reason=timeout`);
  };

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${hrs > 0 ? hrs + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isConnected || quizState === "LOADING" || quizState === "IDLE" || questions.length === 0) {
    return <QuizLoadingScreen />;
  }

  if (quizState === "SUBMITTING") {
    return <QuizSubmittingScreen />;
  }

  const currentQuestion = questions[currentIndex];

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-slate-950 text-white">
      {/* Proctoring Engine */}
      <ProctoringManager emitProctoringWarning={emitProctoringWarning} videoRef={videoRef} />

      {/* Modals & Overlays */}
      <FlaggedBanner />
      <FullscreenReturnOverlay isVisible={!isFullscreen} onReturn={handleReturnFullscreen} />
      <ProctorWarningModal
        open={warningModal.open}
        type={warningModal.type}
        warningCount={totalWarnings}
        maxWarnings={maxTabSwitches}
        onDismiss={() => setWarningModal({ ...warningModal, open: false })}
      />
      <SubmitConfirmModal isOpen={showSubmitModal} onClose={() => setShowSubmitModal(false)} onConfirm={handleManualSubmit} />
      <AutoSubmitModal open={showAutoSubmitModal} onAutoSubmit={handleAutoSubmit} />

      {/* Header */}
      <header className="sticky top-0 z-50 h-20 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} className="lg:hidden text-white/70">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="hidden md:block">
            <h2 className="font-bold text-lg leading-tight">{contest?.title || "Quiz"}</h2>
            <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Question {currentIndex + 1} of {questions.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-6">
          <div className={cn(
            "flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all duration-300",
            timeRemaining < 300 ? "bg-red-500/10 border-red-500/20 text-red-400 animate-pulse" : "bg-white/5 border-white/10"
          )}>
            <Clock className="h-5 w-5" />
            <span className="font-mono text-xl font-bold tracking-tighter">{formatTime(timeRemaining)}</span>
          </div>
          <Button 
            className="rounded-xl font-bold px-6 h-11 bg-orange-500 hover:bg-orange-600 shadow-lg shadow-orange-500/20"
            onClick={() => setShowSubmitModal(true)}
          >
            <Send className="h-4 w-4 mr-2" />
            Submit
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden relative">
        <video ref={videoRef} className="hidden" autoPlay playsInline muted />

        <WidgetErrorBoundary name="Question Player">
          <main className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12">
            <div className="max-w-2xl mx-auto space-y-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  <QuestionCard question={currentQuestion} questionNumber={currentIndex + 1} />

                  <div className="grid gap-3">
                    {currentQuestion.options.map((option, i) => {
                      const isSelected = answers[currentIndex] === option.index;
                      return (
                        <OptionButton
                          key={option.index}
                          option={option}
                          optionLabel={OPTION_LABELS[i] || String(i)}
                          isSelected={isSelected}
                          onClick={() => handleAnswer(currentIndex, option.index)}
                        />
                      );
                    })}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                <Button variant="outline" size="lg" className="rounded-2xl h-14 px-8 border-white/10 text-white" onClick={handlePrevious} disabled={currentIndex === 0}>
                  <ChevronLeft className="h-5 w-5 mr-2" /> Previous
                </Button>
                <Button size="lg" className="rounded-2xl h-14 px-8 bg-white/10 hover:bg-white/20 text-white border-0" onClick={handleNext} disabled={currentIndex === questions.length - 1}>
                  Next <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </main>
        </WidgetErrorBoundary>

        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 right-0 z-50 w-80 bg-slate-900 border-l border-white/5 transition-transform duration-300 lg:static lg:translate-x-0",
          isSidebarOpen ? "translate-x-0 shadow-2xl" : "translate-x-full lg:translate-x-0"
        )}>
          <WidgetErrorBoundary name="Quiz Navigation">
            <div className="flex flex-col h-full">
              <div className="h-20 flex items-center justify-between px-6 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-orange-500" />
                  <h4 className="font-bold">Navigation</h4>
                </div>
                <Button variant="ghost" size="icon" className="lg:hidden text-white/50" onClick={() => setIsSidebarOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((_, idx) => {
                    const isAnswered = answers[idx] !== undefined;
                    const isCurrent = currentIndex === idx;
                    return (
                      <button
                        key={idx}
                        onClick={() => { setCurrentQuestion(idx); setIsSidebarOpen(false); }}
                        className={cn(
                          "h-10 rounded-lg text-xs font-bold transition-all",
                          isCurrent && "ring-2 ring-orange-500 ring-offset-2 ring-offset-slate-900",
                          isAnswered ? "bg-orange-500 text-white" : "bg-white/5 text-white/50 hover:bg-white/10"
                        )}
                      >
                        {idx + 1}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-12 space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-white/5 border border-white/10">
                    <Shield className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-xs font-bold text-orange-400 uppercase">Proctoring Active</p>
                      <p className="text-[10px] text-white/50">Your session is being monitored.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </WidgetErrorBoundary>
        </aside>
      </div>

      <div className="lg:hidden h-20 border-t border-white/5 bg-slate-950/80 backdrop-blur-xl flex items-center justify-around px-4">
        <Button variant="ghost" size="sm" className="flex-col gap-1 h-auto text-white/50" onClick={handlePrevious} disabled={currentIndex === 0}>
          <ChevronLeft className="h-5 w-5" /> <span className="text-[10px]">Prev</span>
        </Button>
        <div className="text-center">
          <p className="text-[10px] font-bold text-white/30 uppercase">Question</p>
          <p className="text-sm font-bold">{currentIndex + 1} / {questions.length}</p>
        </div>
        <Button variant="ghost" size="sm" className="flex-col gap-1 h-auto text-white/50" onClick={handleNext} disabled={currentIndex === questions.length - 1}>
          <ChevronRight className="h-5 w-5" /> <span className="text-[10px]">Next</span>
        </Button>
      </div>
    </div>
  );
}
