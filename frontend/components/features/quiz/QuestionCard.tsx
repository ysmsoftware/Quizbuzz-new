'use client';

// ═══════════════════════════════════════════════════════
// QuestionCard — Renders question header + text + media + flag
// ═══════════════════════════════════════════════════════

import type { QuizQuestion } from '@/lib/stores/quiz-store';
import Image from 'next/image';
import { Flag } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QuestionRenderer } from '@/components/shared/QuestionRenderer';

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
            {/* Compact mobile header — Q-number floats at the top-left so the
                first line of question text starts right beside it, but once
                the text wraps past the label's height it returns to using the
                full card width (no hanging indent wasting the left margin on
                every wrapped line). `overflow-hidden` both clears the float
                (so this container's height includes it) and — as a load-
                bearing side effect — establishes a block formatting context,
                which is what lets the code block below correctly compute its
                available width and actually scroll horizontally instead of
                silently growing the whole layout past the screen edge (the
                classic flex/float "min-width: auto" content-overflow trap). */}
            <div className="lg:hidden overflow-hidden">
                <span className="float-left mr-2 mt-0.5 text-xs font-black tracking-widest text-primary font-mono">
                    Q{questionNumber}
                </span>
                <QuestionRenderer
                    text={question.text}
                    className="text-foreground text-[16px] leading-snug font-bold font-sans"
                />
            </div>

            {/* Header Row — full detail, desktop only */}
            <div className="hidden lg:flex items-center justify-between border-b border-border/60 pb-4">
                <div className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-widest font-black text-primary">
                        Question {questionNumber}
                    </span>
                </div>
            </div>

            {/* Question Text — desktop only; mobile renders it inline with the
                Q-label above instead */}
            <QuestionRenderer
                text={question.text}
                className="hidden lg:block text-foreground text-xl font-medium leading-relaxed font-sans"
            />

            {/* Question Image if present */}
            {question.imageUrl && (
                <div className="relative mt-4 h-[320px] rounded-2xl overflow-hidden border border-border/80 bg-muted/40 shadow-inner group">
                    <Image
                        src={question.imageUrl}
                        alt={`Question ${questionNumber}`}
                        fill
                        sizes="(max-width: 768px) 100vw, 700px"
                        className="object-contain transition-transform duration-300 group-hover:scale-[1.01]"
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
