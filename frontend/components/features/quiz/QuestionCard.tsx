'use client';

// ═══════════════════════════════════════════════════════
// QuestionCard — Renders question header + text + media + flag
// ═══════════════════════════════════════════════════════

import type { QuizQuestion } from '@/lib/stores/quiz-store';
import { Flag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuestionCardProps {
    question: QuizQuestion;
    questionNumber: number;
    isFlagged?: boolean;
    onToggleFlag?: () => void;
}

export function QuestionCard({
    question,
    questionNumber,
    isFlagged = false,
    onToggleFlag
}: QuestionCardProps) {
    return (
        <div className="space-y-3 lg:space-y-4">
            {/* Compact mobile label — plain block, not flex, so a floated camera
          preview can still wrap the question text below it. */}
            <div className="lg:hidden text-xs font-black tracking-widest text-primary font-mono">
                Q{questionNumber}
            </div>

            {/* Header Row — full detail, desktop only */}
            <div className="hidden lg:flex items-center justify-between border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-widest font-black text-primary">
                        Question {questionNumber}
                    </span>
                </div>
            </div>

            {/* Question Text */}
            <div
                className="text-foreground text-[19px] leading-snug font-bold lg:text-xl lg:font-medium lg:leading-relaxed font-sans"
                dangerouslySetInnerHTML={{ __html: question.text }}
            />

            {/* Question Image if present */}
            {question.imageUrl && (
                <div className="relative mt-4 rounded-2xl overflow-hidden border border-border/80 bg-muted/40 shadow-inner group">
                    <img
                        src={question.imageUrl}
                        alt={`Question ${questionNumber}`}
                        className="w-full max-h-[320px] object-contain mx-auto transition-transform duration-300 group-hover:scale-[1.01]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// DifficultyBadge
// ═══════════════════════════════════════════════════════

function DifficultyBadge({ difficulty }: { difficulty: 'easy' | 'medium' | 'hard' }) {
    const styles = {
        easy: 'bg-success/10 text-success border-success/30',
        medium: 'bg-warning/10 text-warning border-warning/30',
        hard: 'bg-destructive/10 text-destructive border-destructive/30',
    };

    return (
        <span className={cn(
            "text-[10px] uppercase tracking-wider rounded-lg px-2 py-0.5 border font-bold capitalize",
            styles[difficulty] || styles.medium
        )}>
            {difficulty}
        </span>
    );
}
