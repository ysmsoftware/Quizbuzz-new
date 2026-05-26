'use client';

import { useState, useMemo, useEffect, useRef, Fragment } from 'react';
import { useParams } from 'next/navigation';
import {
    Plus,
    Upload,
    Search,
    Filter,
    MoreHorizontal,
    Pencil,
    Copy,
    Trash2,
    Eye,
    GripVertical,
    AlertCircle,
    AlertTriangle,
    CheckCircle2,
    Info,
    ChevronDown,
    ArrowRight,
    Download,
    FileJson,
    FileSpreadsheet,
    Loader2,
    X,
    Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useContestDetail } from '@/lib/hooks/useContestDetail';
import { useContestQuestions } from '@/lib/hooks/useContestQuestions';
import * as questionsApi from '@/lib/api/questions.api';
import QuestionBankModal from '@/components/admin/question-bank-modal';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Question, DifficultyLevel, ContestPhase } from '@/lib/types';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/api/queryClient';
import { parseQuestionFile } from '@/lib/utils/question-parser';

export default function QuestionsTabPage() {
    const { id } = useParams() as { id: string };
    const { data: contest } = useContestDetail(id);
    const {
        data: questions,
        isLoading,
        deleteQuestion,
        bulkUpdateQuestions,
        createAndAssignQuestion,
        updateContestQuestion,
        assignMutation
    } = useContestQuestions(id);

    const [searchQuery, setSearchQuery] = useState('');
    const [difficultyFilter, setDifficultyFilter] = useState<'all' | DifficultyLevel>('all');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
    const [isBankModalOpen, setIsBankModalOpen] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<any | null>(null);
    const [expandedQuestionIds, setExpandedQuestionIds] = useState<string[]>([]);

    const toggleExpand = (id: string) => {
        setExpandedQuestionIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const phase = useMemo((): ContestPhase => {
        if (!contest) return 'DRAFT';
        const statusMap: Record<string, ContestPhase> = {
            DRAFT: 'DRAFT',
            PUBLISHED: 'PUBLISHED',
            REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
            LIVE: 'LIVE',
            EVALUATION: 'ENDED',
            RESULTS_OUT: 'RESULTS_PUBLISHED',
            COMPLETED: 'RESULTS_PUBLISHED',
            CANCELLED: 'CANCELLED'
        };
        return statusMap[(contest as any).status] || 'DRAFT';
    }, [contest]);

    const filteredQuestions = useMemo(() => {
        if (!questions) return [];
        return questions.filter(q => {
            const matchesSearch = q.text.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesDifficulty = difficultyFilter === 'all' || q.difficulty === difficultyFilter;
            return matchesSearch && matchesDifficulty;
        });
    }, [questions, searchQuery, difficultyFilter]);

    const stats = useMemo(() => {
        if (!questions) return { total: 0, easy: 0, medium: 0, hard: 0 };
        return {
            total: questions.length,
            easy: questions.filter(q => q.difficulty === 'easy').length,
            medium: questions.filter(q => q.difficulty === 'medium').length,
            hard: questions.filter(q => q.difficulty === 'hard').length,
        };
    }, [questions]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse font-medium">Loading question bank...</p>
            </div>
        );
    }

    const isDraft = phase === 'DRAFT';
    const isLive = phase === 'LIVE';
    const isEnded = phase === 'ENDED' || phase === 'RESULTS_PUBLISHED';
    const isPublished = phase === 'PUBLISHED' || phase === 'REGISTRATION_CLOSED';

    const canEdit = isDraft || isPublished || isEnded;
    const canAdd = isDraft || isPublished;
    const canDelete = isDraft;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* PHASE BANNER */}
            <AnimatePresence>
                {phase !== 'DRAFT' && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "flex items-center justify-between p-4 rounded-xl border",
                            isPublished && "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400",
                            isLive && "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
                            isEnded && "bg-muted/50 border-border text-muted-foreground"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            {isPublished ? <Info className="h-5 w-5" /> :
                                isLive ? <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" /> :
                                    <CheckCircle2 className="h-5 w-5" />}
                            <span className="text-sm font-medium">
                                {isPublished && "You can add new questions. Existing questions cannot be deleted."}
                                {isLive && `Contest is live. Questions are locked. ${(contest as any)?._count?.participants || 0} participants are answering right now.`}
                                {isEnded && "Contest has ended. Only hints and explanations can be edited."}
                            </span>
                        </div>
                        {isLive && (
                            <Button size="sm" variant="outline" className="bg-white/50 border-amber-500/30">
                                Go to Live Monitor
                            </Button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* HEADER ROW */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <WidgetErrorBoundary name="Question Bank Stats">
                    <div className="space-y-1.5">
                        <h1 className="text-3xl font-black tracking-tight">Question Bank</h1>
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-muted-foreground">
                                {stats.total} questions |
                                <span className="text-green-600 dark:text-green-400 ml-1">Easy: {stats.easy}</span> |
                                <span className="text-amber-600 dark:text-amber-400 ml-1">Medium: {stats.medium}</span> |
                                <span className="text-destructive ml-1">Hard: {stats.hard}</span>
                            </span>
                        </div>
                        {/* Difficulty Bar */}
                        <div className="flex h-1.5 w-64 rounded-full overflow-hidden bg-muted mt-2">
                            <div className="bg-green-500" style={{ width: `${(stats.easy / stats.total) * 100}%` }} />
                            <div className="bg-amber-500" style={{ width: `${(stats.medium / stats.total) * 100}%` }} />
                            <div className="bg-destructive" style={{ width: `${(stats.hard / stats.total) * 100}%` }} />
                        </div>
                    </div>
                </WidgetErrorBoundary>

                {canAdd && (
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
                            <Upload className="mr-2 h-4 w-4" />
                            Import CSV
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button className="bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add Question
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                                <DropdownMenuItem onClick={() => setIsQuestionModalOpen(true)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Write manually
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setIsBankModalOpen(true)}>
                                    <Search className="mr-2 h-4 w-4" />
                                    Pick from question bank
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>

            {/* FILTER + SEARCH BAR */}
            <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search questions..."
                        className="pl-9 bg-muted/30"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <div className="flex p-1 bg-muted/50 rounded-lg border border-border/50">
                    {(['all', 'easy', 'medium', 'hard'] as const).map(d => (
                        <button
                            key={d}
                            onClick={() => setDifficultyFilter(d)}
                            className={cn(
                                "px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all",
                                difficultyFilter === d
                                    ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {d}
                        </button>
                    ))}
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                            Sort: Default Order
                            <ChevronDown className="ml-2 h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem>Default Order</DropdownMenuItem>
                        <DropdownMenuItem>A-Z</DropdownMenuItem>
                        <DropdownMenuItem>Hardest First</DropdownMenuItem>
                        <DropdownMenuItem>Newest</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* QUESTIONS TABLE */}
            <WidgetErrorBoundary name="Questions Table">
                <Card className="border-border/50 overflow-hidden">
                    <CardContent className="p-0">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/30 border-b">
                                <tr className="text-muted-foreground font-medium uppercase text-[10px] tracking-widest">
                                    <th className="w-12 px-4 py-3">
                                        <Checkbox
                                            checked={selectedIds.length === filteredQuestions.length && filteredQuestions.length > 0}
                                            onCheckedChange={(checked) => {
                                                if (checked) setSelectedIds(filteredQuestions.map(q => q.id));
                                                else setSelectedIds([]);
                                            }}
                                        />
                                    </th>
                                    <th className="w-12 px-4 py-3">#</th>
                                    <th className="px-4 py-3 text-left">Question</th>
                                    <th className="w-24 px-4 py-3 text-center">Difficulty</th>
                                    <th className="w-20 px-4 py-3 text-center">Marks</th>
                                    <th className="w-24 px-4 py-3 text-center">Neg. Marks</th>
                                    <th className="w-24 px-4 py-3 text-center">Options</th>
                                    <th className="w-20 px-4 py-3 text-center">Hint</th>
                                    <th className="px-4 py-3 text-left">Tags</th>
                                    <th className="w-24 px-4 py-3 text-right pr-6">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {filteredQuestions.length === 0 ? (
                                    <tr>
                                        <td colSpan={10} className="py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                                                    <Search className="h-8 w-8 text-muted-foreground/30" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="font-bold text-lg">No questions found</p>
                                                    <p className="text-muted-foreground text-sm">Try adjusting your filters or search query.</p>
                                                </div>
                                                {canAdd && (
                                                    <Button variant="outline" size="sm" className="mt-2" onClick={() => setIsQuestionModalOpen(true)}>
                                                        Add First Question
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredQuestions.map((q, idx) => {
                                        const isExpanded = expandedQuestionIds.includes(q.id);
                                        return (
                                            <Fragment key={q.id}>
                                                <motion.tr
                                                    layout
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className={cn(
                                                        "group hover:bg-muted/30 transition-colors border-b",
                                                        selectedIds.includes(q.id) && "bg-primary/5",
                                                        isExpanded && "bg-muted/10 border-b-0 hover:bg-muted/10"
                                                    )}
                                                >
                                                    <td className="px-4 py-4">
                                                        <Checkbox
                                                            checked={selectedIds.includes(q.id)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) setSelectedIds(prev => [...prev, q.id]);
                                                                else setSelectedIds(prev => prev.filter(id => id !== q.id));
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                                                        <div className="flex items-center gap-2">
                                                            {isDraft && <GripVertical className="h-3 w-3 opacity-0 group-hover:opacity-100 cursor-grab" />}
                                                            {idx + 1}
                                                        </div>
                                                    </td>
                                                    <td
                                                        className="px-4 py-4 font-medium max-w-[300px] truncate cursor-pointer hover:text-primary transition-colors select-none"
                                                        onClick={() => toggleExpand(q.id)}
                                                    >
                                                        {q.text}
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] font-bold uppercase",
                                                            q.difficulty === 'easy' ? "text-green-600 border-green-500/20 bg-green-500/5" :
                                                                q.difficulty === 'medium' ? "text-amber-600 border-amber-500/20 bg-amber-500/5" :
                                                                    "text-destructive border-destructive/20 bg-destructive/5"
                                                        )}>
                                                            {q.difficulty}
                                                        </Badge>
                                                    </td>
                                                    <td className="px-4 py-4 text-center font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/[0.02]">
                                                        +{q.marks}
                                                    </td>
                                                    <td className="px-4 py-4 text-center font-mono font-bold text-xs text-destructive bg-destructive/[0.02]">
                                                        -{q.negativeMark}
                                                    </td>
                                                    <td className="px-4 py-4 text-center text-muted-foreground">
                                                        {q.options.length} options
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        {q.hint ? (
                                                            <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 text-[10px]">Yes</Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground/30">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-4">
                                                        <div className="flex gap-1.5">
                                                            {q.tags?.slice(0, 2).map((tag: string) => (
                                                                <Badge key={tag} variant="outline" className="text-[9px] h-5 bg-muted/20">{tag}</Badge>
                                                            ))}
                                                            {(q.tags?.length || 0) > 2 && (
                                                                <Badge variant="outline" className="text-[9px] h-5">+{q.tags!.length - 2}</Badge>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-right pr-6">
                                                        <div className="flex justify-end items-center gap-1.5">
                                                            {/* View Options Toggle Button */}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => toggleExpand(q.id)}
                                                                className={cn(
                                                                    "h-8 px-2.5 text-xs gap-1 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200 hover:bg-muted/85",
                                                                    isExpanded && "bg-primary/10 text-primary hover:bg-primary/20 font-bold"
                                                                )}
                                                            >
                                                                <span>{isExpanded ? 'Hide Options' : 'View Options'}</span>
                                                                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isExpanded && "rotate-180")} />
                                                            </Button>

                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/80"
                                                                    >
                                                                        <MoreHorizontal className="h-4 w-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end" className="w-36">
                                                                    {isLive ? (
                                                                        <DropdownMenuItem className="cursor-pointer gap-2">
                                                                            <Eye className="h-4 w-4 text-muted-foreground" />
                                                                            <span>View</span>
                                                                        </DropdownMenuItem>
                                                                    ) : (
                                                                        <>
                                                                            <DropdownMenuItem
                                                                                onClick={() => {
                                                                                    setEditingQuestion(q);
                                                                                    setIsQuestionModalOpen(true);
                                                                                }}
                                                                                className="cursor-pointer gap-2"
                                                                            >
                                                                                <Pencil className="h-4 w-4 text-muted-foreground" />
                                                                                <span>Edit</span>
                                                                            </DropdownMenuItem>


                                                                            <DropdownMenuItem
                                                                                disabled={!canDelete}
                                                                                onClick={() => deleteQuestion(q.id)}
                                                                                className={cn(
                                                                                    "cursor-pointer gap-2 text-destructive focus:text-destructive focus:bg-destructive/5",
                                                                                    !canDelete && "opacity-50 cursor-not-allowed"
                                                                                )}
                                                                            >
                                                                                <Trash2 className="h-4 w-4" />
                                                                                <span>Delete</span>
                                                                            </DropdownMenuItem>
                                                                        </>
                                                                    )}
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    </td>
                                                </motion.tr>

                                                {/* Collapsible Details Drawer Row */}
                                                {isExpanded && (
                                                    <tr className="bg-muted/15 dark:bg-card/25 border-b">
                                                        <td colSpan={10} className="p-6">
                                                            <div className="space-y-6 text-left">
                                                                {/* Answer Options Grid */}
                                                                <div>
                                                                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5 select-none">
                                                                        <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                                                        Answer Choices
                                                                    </h4>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                                        {q.options?.map((option: any, index: number) => {
                                                                            const letter = String.fromCharCode(65 + index);
                                                                            return (
                                                                                <div
                                                                                    key={option.id || index}
                                                                                    className={cn(
                                                                                        "p-3.5 rounded-xl border transition-all duration-200 flex items-center gap-3 shadow-2xs",
                                                                                        option.isCorrect
                                                                                            ? "bg-green-500/5 dark:bg-green-500/10 border-green-500/20 shadow-xs text-green-700 dark:text-green-300 font-extrabold"
                                                                                            : "bg-card/45 border-border/35 hover:bg-card/85 text-foreground/80 font-medium"
                                                                                    )}
                                                                                >
                                                                                    <div
                                                                                        className={cn(
                                                                                            "flex items-center justify-center h-7 w-7 rounded-full text-xs font-black shadow-xs shrink-0",
                                                                                            option.isCorrect
                                                                                                ? "bg-emerald-500 text-white dark:bg-emerald-600"
                                                                                                : "bg-muted-foreground/15 text-muted-foreground"
                                                                                        )}
                                                                                    >
                                                                                        {letter}
                                                                                    </div>
                                                                                    <span className="text-sm leading-relaxed">
                                                                                        {option.text}
                                                                                    </span>
                                                                                    {option.isCorrect && (
                                                                                        <span className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 shrink-0">
                                                                                            <Check className="h-3 w-3" />
                                                                                            Correct
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>

                                                                {/* Hints & Explanations Row */}
                                                                {(q.hint || q.explanation) && (
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                                        {q.hint && (
                                                                            <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 flex gap-3">
                                                                                <Info className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                                                                <div>
                                                                                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400 select-none mb-1">
                                                                                        Hint
                                                                                    </h5>
                                                                                    <p className="text-sm text-amber-800/90 dark:text-amber-300 leading-relaxed font-medium">
                                                                                        {q.hint}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        )}

                                                                        {q.explanation && (
                                                                            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 flex gap-3">
                                                                                <CheckCircle2 className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                                                                <div>
                                                                                    <h5 className="text-[10px] font-bold uppercase tracking-wider text-primary select-none mb-1">
                                                                                        Explanation
                                                                                    </h5>
                                                                                    <p className="text-sm text-foreground/80 dark:text-muted-foreground leading-relaxed font-medium">
                                                                                        {q.explanation}
                                                                                    </p>
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </WidgetErrorBoundary>

            {/* BULK ACTIONS BAR */}
            <AnimatePresence>
                {selectedIds.length > 0 && (
                    <motion.div
                        initial={{ y: 100 }}
                        animate={{ y: 0 }}
                        exit={{ y: 100 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-6 px-6 py-3 bg-foreground text-background rounded-2xl shadow-2xl"
                    >
                        <div className="flex items-center gap-2 pr-6 border-r border-background/20">
                            <span className="text-sm font-black">{selectedIds.length}</span>
                            <span className="text-xs font-medium text-background/60">selected</span>
                            <button
                                className="text-[10px] font-bold uppercase tracking-wider text-primary underline underline-offset-4 ml-2"
                                onClick={() => setSelectedIds([])}
                            >
                                Deselect
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-background hover:bg-background/10 h-8 text-xs">
                                        Difficulty
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuItem onClick={() => bulkUpdateQuestions({ ids: selectedIds, updates: { difficulty: 'easy' } })}>Easy</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => bulkUpdateQuestions({ ids: selectedIds, updates: { difficulty: 'medium' } })}>Medium</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => bulkUpdateQuestions({ ids: selectedIds, updates: { difficulty: 'hard' } })}>Hard</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-red-400 hover:bg-red-400/10 h-8 text-xs"
                                            disabled={!canDelete}
                                        >
                                            Delete
                                        </Button>
                                    </TooltipTrigger>
                                    {!canDelete && <TooltipContent>Cannot delete after publishing</TooltipContent>}
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* IMPORT CSV MODAL */}
            <ImportCSVModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                contestId={id}
                currentCount={questions?.length || 0}
            />

            {/* ADD QUESTION MODAL */}
            <AddQuestionModal
                isOpen={isQuestionModalOpen}
                onClose={() => {
                    setIsQuestionModalOpen(false);
                    setEditingQuestion(null);
                }}
                contestId={id}
                editingQuestion={editingQuestion}
            />

            {/* QUESTION BANK SELECTOR MODAL */}
            <QuestionBankModal
                isOpen={isBankModalOpen}
                onClose={() => setIsBankModalOpen(false)}
                contestId={id}
                currentCount={questions?.length || 0}
            />
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// ImportCSVModal Component
// ═══════════════════════════════════════════════════════

interface ParsedQuestion {
    questionText: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    marks: number;
    negativeMark: number;
    hint?: string;
    explanation?: string;
    tags: string[];
    options: Array<{ text: string; isCorrect: boolean }>;
}

function ImportCSVModal({
    isOpen,
    onClose,
    contestId,
    currentCount
}: {
    isOpen: boolean;
    onClose: () => void;
    contestId: string;
    currentCount: number;
}) {
    const [step, setStep] = useState<'upload' | 'preview'>('upload');
    const [isImporting, setIsImporting] = useState(false);
    const [progress, setProgress] = useState(0);
    const [dragActive, setDragActive] = useState(false);
    const [parsedQuestions, setParsedQuestions] = useState<ParsedQuestion[]>([]);
    const [fileError, setFileError] = useState<string | null>(null);
    const [csvErrors, setCsvErrors] = useState<string[]>([]);
    const [csvWarnings, setCsvWarnings] = useState<string[]>([]);
    const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (isOpen) {
            setStep('upload');
            setDragActive(false);
            setParsedQuestions([]);
            setFileError(null);
            setCsvErrors([]);
            setCsvWarnings([]);
            setUploadedFileName(null);
            setProgress(0);
        }
    }, [isOpen]);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFile(e.target.files[0]);
        }
    };

    const onContainerClick = () => {
        fileInputRef.current?.click();
    };

    const processFile = (file: File) => {
        setFileError(null);
        setCsvErrors([]);
        setCsvWarnings([]);
        setUploadedFileName(file.name);

        const reader = new FileReader();

        if (file.name.endsWith('.json')) {
            reader.onload = (event) => {
                try {
                    const text = event.target?.result as string;
                    if (!text) {
                        throw new Error('File is empty');
                    }

                    const data = JSON.parse(text);
                    if (!Array.isArray(data)) {
                        throw new Error('JSON root must be an array of questions');
                    }

                    const questions: ParsedQuestion[] = data.map((q: any, idx: number) => {
                        if (!q.questionText || typeof q.questionText !== 'string') {
                            throw new Error(`Row ${idx + 1}: questionText is required`);
                        }
                        if (!Array.isArray(q.options) || q.options.length < 2) {
                            throw new Error(`Row ${idx + 1}: At least 2 options are required`);
                        }
                        const hasCorrect = q.options.some((o: any) => o.isCorrect === true);
                        if (!hasCorrect) {
                            throw new Error(`Row ${idx + 1}: At least one option must be correct`);
                        }

                        return {
                            questionText: q.questionText,
                            difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(q.difficulty?.toUpperCase())
                                ? q.difficulty.toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD'
                                : 'MEDIUM',
                            marks: Number(q.marks) || 4,
                            negativeMark: Number(q.negativeMark) || 1,
                            hint: q.hint || '',
                            explanation: q.explanation || '',
                            tags: Array.isArray(q.tags) ? q.tags.map((t: any) => String(t).trim()) : [],
                            options: q.options.map((o: any) => ({
                                text: String(o.text || ''),
                                isCorrect: Boolean(o.isCorrect),
                            })),
                        };
                    });

                    setParsedQuestions(questions);
                    setStep('preview');
                } catch (err: any) {
                    setFileError(err.message || 'Error parsing JSON file');
                    toast.error(err.message || 'Failed to parse JSON file');
                }
            };
            reader.readAsText(file);
        } else if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            reader.onload = (event) => {
                try {
                    const buffer = event.target?.result as ArrayBuffer;
                    if (!buffer) {
                        throw new Error('File buffer is empty');
                    }

                    const { questions, errors, warnings } = parseQuestionFile(buffer, file.name);

                    if (errors.length > 0) {
                        setFileError(errors[0]);
                        setCsvErrors(errors);
                        toast.error('File parsed with validation errors.');
                        return;
                    }

                    setCsvWarnings(warnings);

                    const mappedQuestions: ParsedQuestion[] = questions.map((q) => ({
                        questionText: q.questionText,
                        difficulty: q.difficulty,
                        marks: q.marks ?? 4,
                        negativeMark: q.negativeMark ?? 1,
                        hint: q.hint || '',
                        explanation: q.explanation || '',
                        tags: q.tags,
                        options: q.options.map((o) => ({
                            text: o.text,
                            isCorrect: o.isCorrect,
                        })),
                    }));

                    setParsedQuestions(mappedQuestions);
                    setStep('preview');

                    if (warnings.length > 0) {
                        toast.warning(warnings[0]);
                    } else {
                        toast.success(`Successfully parsed ${mappedQuestions.length} questions.`);
                    }
                } catch (err: any) {
                    setFileError(err.message || 'Error parsing spreadsheet file');
                    toast.error(err.message || 'Failed to parse spreadsheet file');
                }
            };
            reader.readAsArrayBuffer(file);
        } else {
            setFileError('Unsupported file extension. Please upload a .csv, .xlsx, .xls, or .json file');
            toast.error('Unsupported file extension');
        }
    };

    const downloadTemplate = () => {
        const csvContent =
            "questionText,difficulty,marks,negativeMark,option1,option1Correct,option2,option2Correct,option3,option3Correct,option4,option4Correct,hint,explanation,tags\n" +
            '"What is the capital of France?","EASY",4,1,"Paris",true,"London",false,"Berlin",false,"Madrid",false,"Think of Eiffel Tower","Paris is the capital of France.","geography,capitals"\n' +
            '"Which programming language is a typed superset of JavaScript?","MEDIUM",4,1,"TypeScript",true,"Python",false,"Java",false,"C++",false,"Developed by Microsoft","TypeScript compiles to clean JavaScript.","programming,web"';

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "quizbuzz_questions_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleImport = async () => {
        if (parsedQuestions.length === 0) return;
        setIsImporting(true);
        setProgress(15);

        try {
            // 1. Prepare questions payload with position for options
            const questionsPayload = parsedQuestions.map((q) => ({
                questionText: q.questionText,
                difficulty: q.difficulty,
                hint: q.hint || undefined,
                explanation: q.explanation || undefined,
                tags: q.tags || [],
                options: q.options.map((o, idx) => ({
                    text: o.text,
                    isCorrect: o.isCorrect,
                    position: idx,
                })),
            }));

            setProgress(40);

            // 2. Bulk create questions in one transaction
            const bulkRes = await questionsApi.bulkCreateQuestions(questionsPayload);

            const createdIds: string[] = bulkRes.data?.ids ?? [];
            const failedCount = bulkRes.data?.failed ?? 0;

            if (failedCount > 0 && createdIds.length === 0) {
                throw new Error('All questions failed to import');
            }

            setProgress(70);

            // 3. Prepare assignment payload matching success IDs back to original parsed items
            const assignedQuestionsList = createdIds.map((id, index) => {
                const q = parsedQuestions[index];
                return {
                    questionId: id,
                    position: currentCount + index + 1, // 1-based indexing to satisfy positive constraint (>0)
                    marks: q.marks,
                    negativeMark: q.negativeMark,
                };
            });

            // 4. Bulk assign newly created question IDs to the contest
            await questionsApi.assignQuestionsToContest(contestId, assignedQuestionsList);

            setProgress(100);

            queryClient.invalidateQueries({
                queryKey: queryKeys.questions.contestQuestions(contestId),
            });
            queryClient.invalidateQueries({ queryKey: queryKeys.contests.detail(contestId) });

            if (failedCount > 0) {
                toast.warning(`Imported ${createdIds.length} questions, but ${failedCount} questions failed.`);
            } else {
                toast.success(`Successfully imported ${parsedQuestions.length} questions!`);
            }
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Import failed');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className={cn("max-w-2xl transition-all duration-300", step === 'preview' ? "max-w-4xl max-h-[85vh] flex flex-col" : "")}>
                <DialogHeader>
                    <DialogTitle>Import Questions</DialogTitle>
                    <DialogDescription>
                        Import questions from a CSV, Excel, or JSON file. Follow our template for best results.
                    </DialogDescription>
                </DialogHeader>

                <input
                    type="file"
                    ref={fileInputRef}
                    accept=".csv,.xlsx,.xls,.json"
                    className="hidden"
                    onChange={handleFileChange}
                />

                {step === 'upload' && !isImporting && (
                    <div className="space-y-6 py-6">
                        <div
                            onDragEnter={handleDrag}
                            onDragOver={handleDrag}
                            onDragLeave={handleDrag}
                            onDrop={handleDrop}
                            onClick={onContainerClick}
                            className={cn(
                                "flex flex-col items-center justify-center h-[220px] border-2 border-dashed rounded-2xl transition-all cursor-pointer select-none",
                                dragActive
                                    ? "border-primary bg-primary/10 scale-[0.99] shadow-inner"
                                    : "border-muted-foreground/20 bg-muted/10 hover:bg-muted/20 hover:border-muted-foreground/30"
                            )}
                        >
                            <Upload className={cn("h-10 w-10 mb-3 transition-transform duration-200", dragActive ? "text-primary scale-110" : "text-muted-foreground/50")} />
                            <p className="text-sm font-medium">
                                {dragActive ? "Drop files here!" : "Drag CSV, Excel, or JSON file here or click to browse"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">Accepts .csv, .xlsx, .xls, .json (Max 50MB)</p>
                            {uploadedFileName && (
                                <div className="mt-3 px-3 py-1 bg-primary/10 rounded-full border border-primary/20 text-xs font-semibold text-primary flex items-center gap-1.5 animate-pulse">
                                    <span>Selected: {uploadedFileName}</span>
                                </div>
                            )}
                        </div>

                        {fileError && (
                            <div className="space-y-2">
                                <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg font-medium flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                                    <span>{fileError}</span>
                                </div>
                                {csvErrors.length > 1 && (
                                    <div className="p-3 text-xs bg-destructive/5 border border-destructive/10 text-destructive rounded-lg font-medium max-h-[150px] overflow-y-auto space-y-1">
                                        <p className="font-bold border-b border-destructive/15 pb-1 mb-1">All Parsing Errors ({csvErrors.length}):</p>
                                        {csvErrors.map((err, eIdx) => (
                                            <p key={eIdx} className="font-mono text-[10px] leading-relaxed text-destructive/90">• {err}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex items-center justify-between p-4 rounded-xl bg-primary/5 border border-primary/10">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Download className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm font-bold">Import Template</p>
                                    <p className="text-xs text-muted-foreground">Download the required column structure</p>
                                </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={downloadTemplate}>
                                Download CSV
                            </Button>
                        </div>
                    </div>
                )}

                {step === 'preview' && !isImporting && (
                    <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-1 min-h-[300px] max-h-[55vh]">
                        <div className="flex justify-between items-center bg-muted/40 p-3 rounded-lg border text-xs font-semibold">
                            <span className="text-muted-foreground">Uploaded File: <span className="text-foreground">{uploadedFileName}</span></span>
                            <span>{parsedQuestions.length} Questions Parsed Successfully</span>
                        </div>

                        {csvWarnings.length > 0 && (
                            <div className="p-3 text-xs bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg font-medium flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
                                <span>{csvWarnings[0]}</span>
                            </div>
                        )}

                        <div className="space-y-3">
                            {parsedQuestions.map((q, idx) => (
                                <div key={idx} className="p-4 bg-muted/20 border rounded-xl space-y-3 shadow-sm hover:border-primary/20 transition-all">
                                    <div className="flex justify-between items-start gap-3">
                                        <div className="space-y-1">
                                            <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Question #{idx + 1}</span>
                                            <p className="text-sm font-bold text-foreground">{q.questionText}</p>
                                        </div>
                                        <Badge variant="outline" className={cn(
                                            "font-semibold text-xs border uppercase shrink-0",
                                            q.difficulty === 'EASY' && "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
                                            q.difficulty === 'MEDIUM' && "bg-amber-500/10 text-amber-500 border-amber-500/20",
                                            q.difficulty === 'HARD' && "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                        )}>
                                            {q.difficulty}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                                        {q.options.map((opt, oIdx) => (
                                            <div key={oIdx} className={cn(
                                                "p-2 rounded-lg border flex items-center justify-between",
                                                opt.isCorrect
                                                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-semibold"
                                                    : "bg-background/50 text-muted-foreground border-muted/50"
                                            )}>
                                                <span className="truncate">{opt.text}</span>
                                                {opt.isCorrect && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0 ml-1.5" />}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-1.5 items-center justify-between text-xs text-muted-foreground border-t border-muted/30">
                                        <div className="flex gap-4">
                                            <span>Marks: <strong className="text-foreground">{q.marks}</strong></span>
                                            <span>Negative Mark: <strong className="text-foreground">{q.negativeMark}</strong></span>
                                        </div>
                                        {q.tags.length > 0 && (
                                            <div className="flex gap-1">
                                                {q.tags.map((t, tIdx) => (
                                                    <span key={tIdx} className="bg-primary/5 border border-primary/10 px-1.5 py-0.5 rounded text-[10px] text-primary font-medium">
                                                        {t}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isImporting && (
                    <div className="space-y-5 py-12 flex flex-col items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <span className="text-sm font-semibold text-primary animate-pulse">Importing {parsedQuestions.length} Questions...</span>
                            <span className="text-2xl font-bold text-foreground">{progress}%</span>
                        </div>
                        <div className="h-2 w-[80%] bg-muted rounded-full overflow-hidden border">
                            <motion.div
                                className="h-full bg-primary rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.1 }}
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">Uploading questions globally and assigning to your contest...</p>
                    </div>
                )}

                <DialogFooter className={cn(step === 'preview' ? "border-t pt-3" : "")}>
                    {step === 'upload' && !isImporting && (
                        <Button onClick={() => setStep('preview')} disabled={parsedQuestions.length === 0}>
                            Continue to Preview
                        </Button>
                    )}
                    {step === 'preview' && !isImporting && (
                        <div className="flex gap-3 w-full">
                            <Button variant="ghost" onClick={() => setStep('upload')}>Back</Button>
                            <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleImport} disabled={isImporting}>
                                Import {parsedQuestions.length} Questions
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ═══════════════════════════════════════════════════════
// AddQuestionModal Component
// ═══════════════════════════════════════════════════════

function AddQuestionModal({
    isOpen,
    onClose,
    contestId,
    editingQuestion,
}: {
    isOpen: boolean;
    onClose: () => void;
    contestId: string;
    editingQuestion?: any | null;
}) {
    const { createAndAssignQuestion, updateContestQuestion } = useContestQuestions(contestId);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [questionText, setQuestionText] = useState('');
    const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
    const [hint, setHint] = useState('');
    const [explanation, setExplanation] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [marks, setMarks] = useState('4');
    const [negativeMark, setNegativeMark] = useState('1');
    const [options, setOptions] = useState<Array<{ text: string; isCorrect: boolean }>>([
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
    ]);

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            if (editingQuestion) {
                setQuestionText(editingQuestion.text || '');
                setDifficulty(editingQuestion.difficulty ? editingQuestion.difficulty.toUpperCase() as 'EASY' | 'MEDIUM' | 'HARD' : 'MEDIUM');
                setHint(editingQuestion.hint || '');
                setExplanation(editingQuestion.explanation || '');
                setTags(editingQuestion.tags || []);
                setTagInput('');
                setMarks(String(editingQuestion.marks || '4'));
                setNegativeMark(String(editingQuestion.negativeMark || '1'));
                setOptions(
                    editingQuestion.options && editingQuestion.options.length > 0
                        ? editingQuestion.options.map((o: any) => ({ text: o.text || '', isCorrect: !!o.isCorrect }))
                        : [
                            { text: '', isCorrect: false },
                            { text: '', isCorrect: false },
                            { text: '', isCorrect: false },
                            { text: '', isCorrect: false },
                        ]
                );
            } else {
                setQuestionText('');
                setDifficulty('MEDIUM');
                setHint('');
                setExplanation('');
                setTags([]);
                setTagInput('');
                setMarks('4');
                setNegativeMark('1');
                setOptions([
                    { text: '', isCorrect: false },
                    { text: '', isCorrect: false },
                    { text: '', isCorrect: false },
                    { text: '', isCorrect: false },
                ]);
            }
        }
    }, [isOpen, editingQuestion]);

    const handleAddTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
            setTagInput('');
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        }
    };

    const addOption = () => {
        setOptions([...options, { text: '', isCorrect: false }]);
    };

    const removeOption = (index: number) => {
        if (options.length <= 2) return;
        setOptions(options.filter((_, idx) => idx !== index));
    };

    const updateOptionText = (index: number, val: string) => {
        const updated = [...options];
        updated[index].text = val;
        setOptions(updated);
    };

    const updateOptionCorrect = (index: number, checked: boolean) => {
        const updated = [...options];
        updated[index].isCorrect = checked;
        setOptions(updated);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!questionText.trim()) {
            toast.error('Question text is required');
            return;
        }

        const validOptions = options.filter(o => o.text.trim() !== '');
        if (validOptions.length < 2) {
            toast.error('At least 2 non-empty options are required');
            return;
        }

        const hasCorrect = validOptions.some(o => o.isCorrect);
        if (!hasCorrect) {
            toast.error('At least one option must be marked as correct');
            return;
        }

        setIsSubmitting(true);
        try {
            if (editingQuestion) {
                await updateContestQuestion({
                    questionId: editingQuestion.id,
                    contestQuestionId: editingQuestion.contestQuestionId,
                    questionText: questionText.trim(),
                    difficulty,
                    tags,
                    hint: hint.trim() || undefined,
                    explanation: explanation.trim() || undefined,
                    options: validOptions.map(o => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
                    marks: Number(marks) || 4,
                    negativeMark: Number(negativeMark) || 0,
                });
            } else {
                await createAndAssignQuestion({
                    questionText: questionText.trim(),
                    difficulty,
                    hint: hint.trim() || undefined,
                    explanation: explanation.trim() || undefined,
                    tags,
                    options: validOptions.map(o => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
                    marks: Number(marks) || 4,
                    negativeMark: Number(negativeMark) || 0,
                });
            }
            onClose();
        } catch (err: any) {
            toast.error(err.message || `Failed to ${editingQuestion ? 'update' : 'create'} question`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[920px] max-h-[80vh] flex flex-col p-6 rounded-2xl border border-border/40 shadow-2xl">
                <DialogHeader className="pb-3 border-b border-border/40">
                    <DialogTitle className="text-xl font-bold tracking-tight">{editingQuestion ? 'Edit Question' : 'Create New Question'}</DialogTitle>
                    <DialogDescription className="text-xs">
                        {editingQuestion
                            ? 'Modify this question details in the global pool and contest specific settings.'
                            : 'Add a new multiple-choice question to the global pool and assign it to this contest.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 my-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
                        {/* Left Column: Core Question Content */}
                        <div className="md:col-span-7 space-y-5 flex flex-col justify-between">
                            {/* Question Text */}
                            <div className="space-y-2">
                                <Label htmlFor="questionText" className="text-sm font-bold text-foreground/80">Question Text</Label>
                                <Textarea
                                    id="questionText"
                                    placeholder="Enter the question text here..."
                                    className="min-h-[110px] bg-muted/20 border-border/40 focus-visible:ring-primary rounded-xl resize-none text-sm leading-relaxed"
                                    value={questionText}
                                    onChange={(e) => setQuestionText(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Answer Options */}
                            <div className="space-y-3 flex-1 flex flex-col justify-end">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <Label className="text-sm font-bold text-foreground/80">Answer Options</Label>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">Define choices and select the correct ones.</p>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" onClick={addOption} className="h-8 text-xs rounded-lg border-border/40 hover:bg-muted/50 gap-1">
                                        <Plus className="h-3.5 w-3.5" /> Add Choice
                                    </Button>
                                </div>

                                <div className="space-y-2.5 max-h-[250px] overflow-y-auto pr-1">
                                    {options.map((option, idx) => (
                                        <div key={idx} className="flex items-center gap-2.5 bg-muted/10 p-2.5 rounded-xl border border-border/30 hover:border-primary/20 transition-all duration-200">
                                            <Checkbox
                                                id={`correct-${idx}`}
                                                checked={option.isCorrect}
                                                onCheckedChange={(checked) => updateOptionCorrect(idx, !!checked)}
                                                className="h-4.5 w-4.5 rounded-md border-border/50 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                            />
                                            <Input
                                                placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                                                className="flex-1 bg-background h-9 rounded-lg border-border/40 text-sm focus-visible:ring-primary"
                                                value={option.text}
                                                onChange={(e) => updateOptionText(idx, e.target.value)}
                                                required={idx < 2}
                                            />
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg shrink-0 transition-colors"
                                                disabled={options.length <= 2}
                                                onClick={() => removeOption(idx)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Metadata & Settings */}
                        <div className="md:col-span-5 space-y-4 border-t md:border-t-0 md:border-l border-border/30 pt-5 md:pt-0 md:pl-6 flex flex-col justify-between">
                            {/* Marks & Neg Marks */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="marks" className="text-xs font-bold text-foreground/80">Marks</Label>
                                    <Input
                                        id="marks"
                                        type="number"
                                        min="1"
                                        placeholder="4"
                                        className="bg-muted/20 h-9 rounded-lg border-border/40 text-xs font-semibold"
                                        value={marks}
                                        onChange={(e) => setMarks(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="negativeMark" className="text-xs font-bold text-foreground/80">Negative Marks</Label>
                                    <Input
                                        id="negativeMark"
                                        type="number"
                                        min="0"
                                        step="0.25"
                                        placeholder="1"
                                        className="bg-muted/20 h-9 rounded-lg border-border/40 text-xs font-semibold"
                                        value={negativeMark}
                                        onChange={(e) => setNegativeMark(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Difficulty Selector */}
                            <div className="space-y-2">
                                <Label className="text-xs font-bold text-foreground/80">Difficulty</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['EASY', 'MEDIUM', 'HARD'] as const).map((level) => (
                                        <button
                                            key={level}
                                            type="button"
                                            onClick={() => setDifficulty(level)}
                                            className={cn(
                                                "py-2 rounded-lg border text-center font-black text-[9px] uppercase tracking-wider transition-all duration-200 select-none",
                                                difficulty === level
                                                    ? level === 'EASY'
                                                        ? "bg-green-500/10 border-green-500 text-green-700 dark:text-green-400 ring-2 ring-green-500/15"
                                                        : level === 'MEDIUM'
                                                            ? "bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-400 ring-2 ring-amber-500/15"
                                                            : "bg-destructive/10 border-destructive text-destructive ring-2 ring-destructive/15"
                                                    : "border-border/60 bg-background/50 hover:bg-muted/50 text-muted-foreground/80 hover:text-foreground"
                                            )}
                                        >
                                            {level}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Hint Input */}
                            <div className="space-y-1.5">
                                <Label htmlFor="hint" className="text-xs font-bold text-foreground/80">Hint (Optional)</Label>
                                <Input
                                    id="hint"
                                    placeholder="Optional hint for participants..."
                                    className="bg-muted/20 h-9 rounded-lg border-border/40 text-xs"
                                    value={hint}
                                    onChange={(e) => setHint(e.target.value)}
                                />
                            </div>

                            {/* Explanation Input */}
                            <div className="space-y-1.5">
                                <Label htmlFor="explanation" className="text-xs font-bold text-foreground/80">Explanation (Optional)</Label>
                                <Textarea
                                    id="explanation"
                                    placeholder="Why is this answer correct?"
                                    className="min-h-[60px] bg-muted/20 rounded-lg border-border/40 text-xs resize-none"
                                    value={explanation}
                                    onChange={(e) => setExplanation(e.target.value)}
                                />
                            </div>

                            {/* Tags Input */}
                            <div className="space-y-2">
                                <Label htmlFor="tagInput" className="text-xs font-bold text-foreground/80">Tags</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="tagInput"
                                        placeholder="Add tag..."
                                        className="bg-muted/20 h-9 rounded-lg border-border/40 text-xs flex-1"
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={handleTagKeyDown}
                                    />
                                    <Button type="button" variant="secondary" onClick={handleAddTag} className="rounded-lg h-9 text-xs px-3 font-semibold">Add</Button>
                                </div>
                                {tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 max-h-[70px] overflow-y-auto pt-1">
                                        {tags.map((tag) => (
                                            <Badge key={tag} variant="secondary" className="flex items-center gap-1 py-0.5 pl-2 pr-1 text-[9px] font-bold rounded-md bg-primary/5 text-primary border border-primary/10 select-none">
                                                {tag}
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTag(tag)}
                                                    className="h-3 w-3 rounded-full hover:bg-primary/20 flex items-center justify-center transition-colors"
                                                >
                                                    <X className="h-2 w-2" />
                                                </button>
                                            </Badge>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </form>

                <DialogFooter className="border-t border-border/40 pt-4 gap-2 flex items-center justify-end">
                    <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="rounded-xl h-10 text-sm font-semibold text-muted-foreground hover:text-foreground">Cancel</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting} className="px-6 font-black rounded-xl h-10 text-sm bg-primary hover:bg-primary/95 text-primary-foreground shadow-md shadow-primary/10">
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {editingQuestion ? 'Saving...' : 'Creating...'}
                            </>
                        ) : (
                            editingQuestion ? 'Save Changes' : 'Create Question'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}