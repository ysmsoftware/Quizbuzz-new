'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  HelpCircle,
  ChevronDown,
  BookOpen,
  Edit2,
  Trash2,
  CheckCircle2,
  Info,
  MoreHorizontal,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface QuestionOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface Question {
  id: string;
  questionText: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  tags?: string[];
  hint?: string | null;
  explanation?: string | null;
  options?: QuestionOption[];
}

interface QuestionQuestionsListComponentProps {
  questions: Question[];
  isLoading?: boolean;
  isFetching?: boolean;
  onEdit?: (question: Question) => void;
  onDelete?: (question: Question) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectToggle?: (id: string) => void;
  emptyState?: React.ReactNode;
}

export default function QuestionQuestionsListComponent({
  questions = [],
  isLoading = false,
  isFetching = false,
  onEdit,
  onDelete,
  selectable = false,
  selectedIds = [],
  onSelectToggle,
  emptyState,
}: QuestionQuestionsListComponentProps) {
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedQuestionId((prev) => (prev === id ? null : id));
  };

  if (isLoading) {
    return (
      <div className="border border-border/30 rounded-2xl bg-card/10 backdrop-blur-md overflow-hidden divide-y divide-border/20 shadow-sm">
        {[...Array(5)].map((_, idx) => (
          <div
            key={idx}
            className="p-5 h-20 animate-pulse flex items-center justify-between gap-4 bg-card/5"
          >
            <div className="flex items-center gap-3 flex-1">
              <div className="h-5 w-5 bg-muted/60 rounded-md shrink-0" />
              <div className="h-6 w-24 bg-muted/60 rounded-full shrink-0" />
              <div className="h-6 w-1/2 bg-muted/60 rounded-md" />
            </div>
            <div className="h-8 w-8 bg-muted/60 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (questions.length === 0) {
    if (emptyState) return <>{emptyState}</>;

    return (
      <div className="bg-card/25 border border-border/30 backdrop-blur-md rounded-2xl p-16 text-center shadow-inner">
        <HelpCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30 stroke-[1.5]" />
        <h3 className="text-lg font-bold text-foreground/80 mb-1">No Questions Found</h3>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          No questions available. Add a new question to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {/* Desktop Table Headers */}
      <div className="grid grid-cols-12 gap-0 border border-border/40 rounded-xl bg-muted/20 text-xs font-bold uppercase tracking-wider text-muted-foreground/80 select-none hidden md:grid shadow-xs">
        {selectable && (
          <div className="col-span-1 border-r border-border/25 py-3.5 flex items-center justify-center">
            Select
          </div>
        )}
        <div className={`${selectable ? 'col-span-9' : 'col-span-10'} px-6 py-3.5 border-r border-border/25 flex items-center`}>
          Question Text
        </div>
        <div className="col-span-2 px-6 py-3.5 flex items-center justify-end text-right">
          Actions
        </div>
      </div>

      {/* Staggered Rows List */}
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: { staggerChildren: 0.02 },
          },
        }}
        className="space-y-3"
      >
        {questions.map((question) => {
          const isExpanded = expandedQuestionId === question.id;
          const isEasy = question.difficulty === 'EASY';
          const isMedium = question.difficulty === 'MEDIUM';
          const isSelected = selectedIds.includes(question.id);

          return (
            <motion.div
              key={question.id}
              variants={{
                hidden: { opacity: 0, y: 8 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { type: 'spring', stiffness: 350, damping: 28 },
                },
              }}
              className={`group relative transition-all duration-300 border border-border/30 rounded-xl overflow-hidden shadow-xs hover:shadow-md ${
                isExpanded 
                  ? 'bg-card/70 border-primary/30 shadow-inner shadow-black/5 ring-1 ring-primary/5' 
                  : 'bg-card/25 backdrop-blur-md hover:bg-card/45 hover:-translate-y-1 hover:border-primary/25 hover:z-10'
              } ${isSelected ? 'bg-primary/5 border-primary/20' : ''}`}
            >
              {/* Main Table Row */}
              <div className="grid grid-cols-12 gap-0 items-stretch">
                
                {/* Select Column (Conditional) */}
                {selectable && onSelectToggle && (
                  <div className="col-span-12 md:col-span-1 border-b md:border-b-0 md:border-r border-border/20 py-4 flex items-center justify-center bg-muted/5">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onSelectToggle(question.id)}
                      className="rounded-md h-4.5 w-4.5 border-border/60 data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all"
                    />
                  </div>
                )}

                {/* Question Text Column */}
                <div
                  className={`col-span-12 px-6 py-4 cursor-pointer select-none border-b md:border-b-0 md:border-r border-border/20 flex flex-col justify-center ${
                    selectable ? 'md:col-span-9' : 'md:col-span-10'
                  }`}
                  onClick={() => toggleExpand(question.id)}
                >
                  <h3 className="text-sm font-semibold tracking-tight text-foreground/90 group-hover:text-primary transition-colors leading-relaxed">
                    {question.questionText}
                  </h3>
                  
                  {/* Brief metadata under text */}
                  <p className="text-xs text-muted-foreground/75 mt-1.5 flex flex-wrap items-center gap-1.5 font-medium leading-none">
                    <BookOpen className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                    <span>{question.options?.length || 0} options</span>
                    {question.hint && (
                      <>
                        <span className="text-muted-foreground/30">•</span>
                        <span className="text-amber-600 dark:text-amber-400 flex items-center gap-0.5 font-bold">
                          Has hint
                        </span>
                      </>
                    )}
                    <span className="text-muted-foreground/30">•</span>
                    <span
                      className={`font-semibold ${
                        isEasy
                          ? 'text-emerald-600 dark:text-emerald-400 font-extrabold'
                          : isMedium
                          ? 'text-blue-600 dark:text-blue-400 font-extrabold'
                          : 'text-rose-600 dark:text-rose-400 font-extrabold'
                      }`}
                    >
                      {question.difficulty?.charAt(0) +
                        question.difficulty?.slice(1).toLowerCase()}
                    </span>
                    {question.tags && question.tags.length > 0 ? (
                      question.tags.map((tag) => (
                        <span key={tag} className="flex items-center gap-1.5">
                          <span className="text-muted-foreground/30">•</span>
                          <span className="font-bold uppercase text-[10px] tracking-wider text-muted-foreground/90 bg-muted/40 px-1.5 py-0.5 rounded-md border border-border/10">
                            {tag}
                          </span>
                        </span>
                      ))
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <span className="text-muted-foreground/30">•</span>
                        <span className="font-bold uppercase text-[10px] tracking-wider text-muted-foreground/60">
                          General
                        </span>
                      </span>
                    )}
                  </p>
                </div>

                {/* Actions Column */}
                <div className="col-span-12 md:col-span-2 px-6 py-4 flex items-center justify-end gap-2">
                  {/* Option Grid Toggler */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpand(question.id)}
                    className={`h-8 px-3 text-xs gap-1.5 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-300 hover:bg-secondary/65 ${
                      isExpanded ? 'bg-primary/10 text-primary hover:bg-primary/20 font-black' : ''
                    }`}
                  >
                    <span>{isExpanded ? 'Hide Options' : 'View Options'}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                  </Button>

                  {/* Three-Dot Actions Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/65 shrink-0 transition-colors"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 rounded-xl border-border/40 p-1 bg-popover/95 backdrop-blur-md shadow-lg">
                      {onEdit && (
                        <DropdownMenuItem
                          onClick={() => onEdit(question)}
                          className="gap-2 cursor-pointer rounded-lg text-sm transition-colors"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </DropdownMenuItem>
                      )}
                      {onDelete && (
                        <DropdownMenuItem
                          onClick={() => onDelete(question)}
                          className="gap-2 cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 dark:focus:bg-destructive/20 rounded-lg text-sm transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Delete</span>
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Collapsible Details Panel */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{
                      height: 'auto',
                      opacity: 1,
                      transition: {
                        height: { duration: 0.25, ease: 'easeOut' },
                        opacity: { duration: 0.2 },
                      },
                    }}
                    exit={{
                      height: 0,
                      opacity: 0,
                      transition: {
                        height: { duration: 0.2, ease: 'easeIn' },
                        opacity: { duration: 0.15 },
                      },
                    }}
                    className="border-t border-border/30 bg-muted/15 dark:bg-card/25"
                  >
                    <div className="p-6 space-y-6">
                      {/* Answer Options Grid */}
                      <div>
                        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5 select-none">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          Answer Choices
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {question.options?.map((option, index) => {
                            const letter = String.fromCharCode(65 + index);
                            return (
                              <div
                                key={option.id || index}
                                className={`p-3.5 rounded-xl border transition-all duration-200 flex items-center gap-3 shadow-2xs ${
                                  option.isCorrect
                                    ? 'bg-emerald-500/10 border-emerald-500/40 shadow-xs'
                                    : 'bg-card/45 border-border/35 hover:bg-card/85 text-foreground/80'
                                }`}
                              >
                                <div
                                  className={`flex items-center justify-center h-7 w-7 rounded-full text-xs font-black shadow-xs shrink-0 ${
                                    option.isCorrect
                                      ? 'bg-emerald-500 text-white dark:bg-emerald-600'
                                      : 'bg-muted-foreground/15 text-muted-foreground'
                                  }`}
                                >
                                  {letter}
                                </div>
                                <span className={`text-sm leading-relaxed ${option.isCorrect ? 'text-zinc-950 dark:text-zinc-50 font-black' : 'text-foreground/80 font-medium'}`}>
                                  {option.text}
                                </span>
                                {option.isCorrect && (
                                  <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 shrink-0">
                                    <ShieldCheck className="h-3 w-3" />
                                    Correct
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Hints & Explanations row */}
                      {(question.hint || question.explanation) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                          {question.hint && (
                            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 flex gap-3">
                              <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                              <div>
                                <h5 className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 select-none mb-1">
                                  Hint
                                </h5>
                                <p className="text-sm text-amber-800/90 dark:text-amber-300 leading-relaxed font-medium">
                                  {question.hint}
                                </p>
                              </div>
                            </div>
                          )}

                          {question.explanation && (
                            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 flex gap-3">
                              <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                              <div>
                                <h5 className="text-[10px] font-bold uppercase tracking-wider text-primary select-none mb-1">
                                  Explanation
                                </h5>
                                <p className="text-sm text-foreground/80 dark:text-muted-foreground leading-relaxed font-medium">
                                  {question.explanation}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
