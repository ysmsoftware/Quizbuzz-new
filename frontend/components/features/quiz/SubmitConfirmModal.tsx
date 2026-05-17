'use client';

import { CheckCircle2, Flag, AlertCircle, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useQuizStore } from '@/lib/stores/quiz-store';

// ═══════════════════════════════════════════════════════
// SubmitConfirmModal — Manual submission confirmation
// ═══════════════════════════════════════════════════════

interface SubmitConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function SubmitConfirmModal({ isOpen, onClose, onConfirm, isSubmitting }: SubmitConfirmModalProps) {
  const questions = useQuizStore((s) => s.questions);
  const answers = useQuizStore((s) => s.answers);
  const flagged = useQuizStore((s) => s.flagged);

  const total = questions.length;
  const answeredCount = Object.keys(answers).length;
  const flaggedCount = flagged.length;
  const unansweredCount = total - answeredCount;

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !isSubmitting && !val && onClose()}>
      <DialogContent className="max-w-md bg-slate-900 border-white/10 text-white shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Submit Your Quiz?</DialogTitle>
          <DialogDescription className="text-white/50">
            Please review before submitting. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {/* Summary Table */}
        <div className="space-y-2 my-4">
          <SummaryRow 
            icon={<CheckCircle2 className="w-4 h-4 text-green-400" />}
            label="Answered"
            value={`${answeredCount} / ${total}`}
            bg="bg-green-500/10"
          />
          {flaggedCount > 0 && (
            <SummaryRow 
              icon={<Flag className="w-4 h-4 text-amber-400" />}
              label="Flagged for review"
              value={flaggedCount}
              bg="bg-amber-500/10"
            />
          )}
          {unansweredCount > 0 && (
            <SummaryRow 
              icon={<AlertCircle className="w-4 h-4 text-red-400" />}
              label="Not answered"
              value={unansweredCount}
              bg="bg-red-500/10"
            />
          )}
        </div>

        {/* Unanswered Warning */}
        {unansweredCount > 0 && (
          <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-700/30 flex gap-3 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-200/80 leading-relaxed">
              You have <span className="text-amber-400 font-bold">{unansweredCount}</span> unanswered question(s). 
              Unanswered questions will be marked as skipped.
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-3 sm:gap-0">
          <Button
            variant="outline"
            disabled={isSubmitting}
            onClick={onClose}
            className="flex-1 border-white/10 text-white/70 hover:bg-white/5"
          >
            Continue Quiz
          </Button>
          <Button
            disabled={isSubmitting}
            onClick={onConfirm}
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Now'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryRow({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string | number; bg: string }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl ${bg}`}>
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className="text-sm font-bold font-mono">{value}</span>
    </div>
  );
}
