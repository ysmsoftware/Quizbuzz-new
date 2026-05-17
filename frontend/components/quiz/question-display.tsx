"use client";

import { motion } from "framer-motion";
import { Flag, CheckCircle } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuizStore } from "@/lib/stores/quiz-store";
import type { Question } from "@/lib/types";

interface QuestionDisplayProps {
  question: Question;
  questionNumber: number;
  selectedOption: number | null;
  isMarkedForReview: boolean;
}

export function QuestionDisplay({
  question,
  questionNumber,
  selectedOption,
  isMarkedForReview,
}: QuestionDisplayProps) {
  const { setAnswer } = useQuizStore();

  const handleOptionSelect = (optionIndex: number) => {
    setAnswer(questionNumber - 1, optionIndex);
  };

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-semibold">
              {questionNumber}
            </span>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{question.difficulty}</Badge>
              <Badge variant="secondary">{question.marks} marks</Badge>
              {isMarkedForReview && (
                <Badge variant="outline" className="border-warning text-warning">
                  <Flag className="h-3 w-3 mr-1" />
                  Marked for Review
                </Badge>
              )}
            </div>
          </div>
        </div>

        <h2 className="text-lg md:text-xl font-medium text-foreground mt-4 leading-relaxed">
          {question.text}
        </h2>

        {question.imageUrl && (
          <div className="mt-4 rounded-lg overflow-hidden border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={question.imageUrl}
              alt="Question illustration"
              className="w-full max-h-64 object-contain"
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="px-0 pt-2">
        <div className="space-y-3">
          {question.options.map((option, index) => {
            const isSelected = selectedOption === index;
            const optionLabel = String.fromCharCode(65 + index); // A, B, C, D...

            return (
              <motion.button
                key={index}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleOptionSelect(index)}
                className={`
                  w-full text-left p-4 rounded-lg border-2 transition-all
                  flex items-center gap-4
                  ${isSelected
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                  }
                `}
              >
                <span
                  className={`
                    flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                    font-semibold text-sm transition-colors
                    ${isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                    }
                  `}
                >
                  {isSelected ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    optionLabel
                  )}
                </span>
                <span
                  className={`
                    flex-1 text-base
                    ${isSelected ? "text-foreground font-medium" : "text-foreground"}
                  `}
                >
                  {typeof option === 'string' ? option : option.text}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Clear Selection */}
        {selectedOption !== null && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setAnswer(questionNumber - 1, -1)}
            className="mt-4 text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear selection
          </motion.button>
        )}
      </CardContent>
    </Card>
  );
}
