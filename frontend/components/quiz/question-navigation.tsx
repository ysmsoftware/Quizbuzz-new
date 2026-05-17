"use client";

import { Flag, CheckCircle, Circle } from "lucide-react";
import type { QuizQuestion } from "@/lib/stores/quiz-store";

interface QuestionNavigationProps {
  questions: QuizQuestion[];
  answers: Record<number, number>;
  flagged: number[];
  currentIndex: number;
  onNavigate: (index: number) => void;
}

export function QuestionNavigation({
  questions,
  answers,
  flagged,
  currentIndex,
  onNavigate,
}: QuestionNavigationProps) {
  const answeredCount = Object.keys(answers).length;
  const markedCount = flagged.length;
  const notVisitedCount = questions.length - answeredCount - markedCount;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-foreground">Question Navigation</h3>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-success flex items-center justify-center">
            <CheckCircle className="h-3 w-3 text-success-foreground" />
          </div>
          <span className="text-muted-foreground">Answered ({answeredCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-warning flex items-center justify-center">
            <Flag className="h-3 w-3 text-warning-foreground" />
          </div>
          <span className="text-muted-foreground">Marked ({markedCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
            <Circle className="h-3 w-3 text-muted-foreground" />
          </div>
          <span className="text-muted-foreground">Not visited ({notVisitedCount})</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border-2 border-primary flex items-center justify-center">
            <span className="text-xs font-medium text-primary">1</span>
          </div>
          <span className="text-muted-foreground">Current</span>
        </div>
      </div>

      {/* Question Grid */}
      <div className="grid grid-cols-5 gap-2">
        {questions.map((_, index) => {
          const answerIndex = answers[index];
          const isAnswered = answerIndex !== undefined && answerIndex >= 0;
          const isMarked = flagged.includes(index);
          const isCurrent = index === currentIndex;

          let bgClass = "bg-muted text-muted-foreground";
          let Icon = Circle;

          if (isAnswered && !isMarked) {
            bgClass = "bg-success text-success-foreground";
            Icon = CheckCircle;
          } else if (isMarked) {
            bgClass = "bg-warning text-warning-foreground";
            Icon = Flag;
          }

          return (
            <button
              key={index}
              onClick={() => onNavigate(index)}
              className={`
                aspect-square rounded-lg flex flex-col items-center justify-center
                text-sm font-medium transition-all
                ${bgClass}
                ${isCurrent ? "ring-2 ring-primary ring-offset-2" : ""}
                hover:opacity-80
              `}
              title={`Question ${index + 1}${isMarked ? " (Marked)" : ""}${isAnswered ? " (Answered)" : ""}`}
            >
              <span>{index + 1}</span>
            </button>
          );
        })}
      </div>

      {/* Summary */}
      <div className="pt-4 border-t space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Answered</span>
          <span className="font-medium text-foreground">
            {answeredCount} / {questions.length}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Remaining</span>
          <span className="font-medium text-foreground">
            {questions.length - answeredCount}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">For Review</span>
          <span className="font-medium text-warning">
            {markedCount}
          </span>
        </div>
      </div>
    </div>
  );
}
