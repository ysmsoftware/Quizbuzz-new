'use client';

// ═══════════════════════════════════════════════════════
// QuestionCard — Renders question header + text
// ═══════════════════════════════════════════════════════

import type { QuizQuestion } from '@/lib/stores/quiz-store';

interface QuestionCardProps {
  question: QuizQuestion;
  questionNumber: number;
}

export function QuestionCard({ question, questionNumber }: QuestionCardProps) {
  return (
    <div>
      {/* Header Row */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-white/50">
          Question {questionNumber}
        </span>
        <DifficultyBadge difficulty={question.difficulty} />
      </div>

      {/* Question Text */}
      <div
        className="text-white text-lg sm:text-lg leading-relaxed"
        dangerouslySetInnerHTML={{ __html: question.text }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// DifficultyBadge
// ═══════════════════════════════════════════════════════

function DifficultyBadge({ difficulty }: { difficulty: 'easy' | 'medium' | 'hard' }) {
  const styles = {
    easy: 'bg-green-900/50 text-green-300 border-green-700',
    medium: 'bg-amber-900/50 text-amber-300 border-amber-700',
    hard: 'bg-red-900/50 text-red-300 border-red-700',
  };

  return (
    <span className={`text-xs rounded-full px-2.5 py-0.5 border font-medium capitalize ${styles[difficulty]}`}>
      {difficulty}
    </span>
  );
}
