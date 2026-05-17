"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Home, BarChart3, Clock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WidgetErrorBoundary } from "@/components/shared/WidgetErrorBoundary";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useProctoringStore } from "@/lib/stores/proctoring-store";
import { contestService } from "@/lib/services/contest-service";
import type { Contest } from "@/lib/types";

export default function SubmittedPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  
  const [contest, setContest] = useState<Contest | null>(null);
  const [loading, setLoading] = useState(true);
  
  const clearSession = useAuthStore((s) => s.clearSession);
  const stopProctoring = useProctoringStore((s) => s.stopProctoring);

  useEffect(() => {
    // 1. Fetch contest info for context
    const load = async () => {
      if (slug) {
        const res = await contestService.getContestBySlug(slug);
        if (res.success && res.data) {
          setContest(res.data);
        }
      }
      setLoading(false);
    };
    load();

    // 2. Perform cleanup
    stopProctoring();
    
    // 3. Clear session after a small delay (to allow user to see info)
    // Actually, we keep it for results if needed, but rule 07 says we cleanup on exit.
    // For now, we keep it so they can see this page.
  }, [slug, stopProctoring]);

  const handleGoHome = () => {
    clearSession();
    router.push("/");
  };

  const handleViewLeaderboard = () => {
    router.push(`/quiz/${slug}/leaderboard`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-lg w-full">
        <WidgetErrorBoundary name="Submission Success View">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-3xl p-8 border text-center shadow-xl"
          >
            <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-success" />
            </div>

            <h1 className="text-3xl font-bold text-foreground mb-3">Quiz Submitted!</h1>
            <p className="text-muted-foreground mb-8">
              Excellent work! Your responses have been securely submitted for evaluation.
            </p>

            <div className="grid grid-cols-2 gap-4 mb-10">
              <div className="p-4 rounded-2xl bg-muted/50 border text-left">
                <Clock className="w-5 h-5 text-primary mb-2" />
                <p className="text-xs text-muted-foreground">Results Release</p>
                <p className="text-sm font-semibold text-foreground">
                  {contest?.resultsDeclared ? "Already Declared" : "TBA"}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-muted/50 border text-left">
                <Trophy className="w-5 h-5 text-primary mb-2" />
                <p className="text-xs text-muted-foreground">Total Marks</p>
                <p className="text-sm font-semibold text-foreground">
                  {contest?.totalMarks || "—"}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button 
                size="lg" 
                className="w-full rounded-2xl gap-2"
                onClick={handleViewLeaderboard}
              >
                <BarChart3 className="w-5 h-5" />
                View Leaderboard
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="w-full rounded-2xl gap-2"
                onClick={handleGoHome}
              >
                <Home className="w-5 h-5" />
                Return Home
              </Button>
            </div>

            <p className="mt-8 text-xs text-muted-foreground">
              A confirmation has been sent to your registered contact.
              <br />
              Participant ID: <span className="font-mono">{useAuthStore.getState().participantId}</span>
            </p>
          </motion.div>
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}
