"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, Clock } from "lucide-react";
import { WidgetErrorBoundary } from "@/components/shared/WidgetErrorBoundary";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useProctoringStore } from "@/lib/stores/proctoring-store";
import { contestService } from "@/lib/services/contest-service";

export default function SubmittedPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [contest, setContest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const stopProctoring = useProctoringStore((s) => s.stopProctoring);
  const participantId = useAuthStore((s) => s.participantId);

  useEffect(() => {
    // Stop camera / proctoring monitors immediately
    stopProctoring();

    // Fetch contest info for the results-release display
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
  }, [slug, stopProctoring]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const resultsLabel = contest?.resultsPublishedAt
    ? "Already Declared"
    : contest?.showResultsAfter
    ? `~${contest.showResultsAfter} hours after the contest ends`
    : "To be announced by the organiser";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="max-w-lg w-full">
        <WidgetErrorBoundary name="Submission Success View">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card rounded-3xl p-8 border text-center shadow-xl"
          >
            {/* Icon */}
            <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-500" />
            </div>

            {/* Heading */}
            <h1 className="text-3xl font-bold text-foreground mb-3">Quiz Submitted!</h1>
            <p className="text-muted-foreground mb-8">
              Your responses have been securely recorded. You can safely close this
              browser tab — no further action is needed.
            </p>

            {/* Results release info */}
            <div className="p-4 rounded-2xl bg-muted/50 border text-left mb-10 flex items-center gap-3">
              <Clock className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Results Release</p>
                <p className="text-sm font-semibold text-foreground">{resultsLabel}</p>
              </div>
            </div>

            {/* Participant reference */}
            <p className="text-xs text-muted-foreground">
              A confirmation will be sent to your registered contact.
              <br />
              Participant ID:{" "}
              <span className="font-mono text-foreground/70">{participantId}</span>
            </p>
          </motion.div>
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}
