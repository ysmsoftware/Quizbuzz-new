'use client';

import { useQuizStore } from '@/lib/stores/quiz-store';

export function QuizProgressBar() {
  const total = useQuizStore((s) => s.questions.length);
  const answered = Object.keys(useQuizStore((s) => s.answers)).length;
  const progress = total > 0 ? (answered / total) * 100 : 0;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-3">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/60 font-medium">Progress</span>
          <span className="text-xs text-white/60 font-mono">{answered}/{total} answered</span>
        </div>
        <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-400 to-orange-600 transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
