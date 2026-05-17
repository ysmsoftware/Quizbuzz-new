'use client';

import { useQuizStore } from '@/lib/stores/quiz-store';

// ═══════════════════════════════════════════════════════
// QuizProgressStats — 3 stat chips with separators
// ═══════════════════════════════════════════════════════

export function QuizProgressStats() {
  const answered = useQuizStore((s) => Object.keys(s.answers).length);
  const flaggedCount = useQuizStore((s) => s.flagged.length);
  const total = useQuizStore((s) => s.questions.length);
  const remaining = total - answered;

  return (
    <div className="flex items-center gap-0 text-xs">
      <StatChip label="Answered" value={answered} valueClass="text-green-400" />
      <Separator />
      <StatChip label="Flagged" value={flaggedCount} valueClass="text-amber-400" />
      <Separator />
      <StatChip label="Remaining" value={remaining} valueClass="text-white/80" />
    </div>
  );
}

function StatChip({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: number;
  valueClass: string;
}) {
  return (
    <span className="text-white/50 px-2">
      {label}:{' '}
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </span>
  );
}

function Separator() {
  return <span className="text-white/15">|</span>;
}
