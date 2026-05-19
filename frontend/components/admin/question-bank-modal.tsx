'use client';

import { useState, useEffect, useRef } from 'react';
import {
    Search,
    Loader2,
    Trash2,
    Filter,
    Layers,
    AlertTriangle,
    CheckCircle2,
    Sparkles,
    Sliders,
    Dices
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuestions, useQuestionTags } from '@/lib/hooks/useQuestions';
import { useContestQuestions } from '@/lib/hooks/useContestQuestions';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

// Helper utility for proportional percentage adjustments
function adjustPercentages(
    values: number[],
    changedIndex: number,
    newValue: number,
    targetSum: number = 100
): number[] {
    const n = values.length;
    const result = [...values];
    result[changedIndex] = newValue;

    const remaining = targetSum - newValue;
    const oldSumOthers = values.reduce((sum, val, idx) => idx === changedIndex ? sum : sum + val, 0);

    if (oldSumOthers > 0) {
        // Proportional distribution
        let distributedSum = 0;
        const otherIndices = Array.from({ length: n }, (_, i) => i).filter(i => i !== changedIndex);

        otherIndices.forEach(idx => {
            const share = Math.round((values[idx] / oldSumOthers) * remaining);
            result[idx] = share;
            distributedSum += share;
        });

        // Fix rounding errors
        let diff = remaining - distributedSum;
        if (diff !== 0) {
            const step = diff > 0 ? 1 : -1;
            while (diff !== 0) {
                let adjusted = false;
                for (const idx of otherIndices) {
                    if (diff === 0) break;
                    if (step === -1 && result[idx] <= 0) continue; // Can't go below 0
                    if (step === 1 && result[idx] >= targetSum) continue; // Can't go above target
                    result[idx] += step;
                    diff -= step;
                    adjusted = true;
                }
                if (!adjusted) {
                    // Fallback to force distribution if everything is stuck at bounds
                    for (const idx of otherIndices) {
                        if (diff === 0) break;
                        result[idx] = Math.max(0, Math.min(targetSum, result[idx] + diff));
                        diff = 0;
                    }
                    break;
                }
            }
        }
    } else {
        // Equal distribution because others were 0
        const otherIndices = Array.from({ length: n }, (_, i) => i).filter(i => i !== changedIndex);
        const countOthers = otherIndices.length;
        const baseShare = Math.floor(remaining / countOthers);
        let distributedSum = 0;

        otherIndices.forEach(idx => {
            result[idx] = baseShare;
            distributedSum += baseShare;
        });

        let diff = remaining - distributedSum;
        for (let i = 0; i < diff; i++) {
            if (otherIndices[i] !== undefined) {
                result[otherIndices[i]!] += 1;
            }
        }
    }

    return result;
}

interface QuestionBankModalProps {
    isOpen: boolean;
    onClose: () => void;
    contestId: string;
    currentCount: number;
}

export default function QuestionBankModal({
    isOpen,
    onClose,
    contestId,
    currentCount
}: QuestionBankModalProps) {
    const [activeTab, setActiveTab] = useState<'manual' | 'auto'>('manual');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [search, setSearch] = useState('');
    const [difficulty, setDifficulty] = useState<'all' | 'EASY' | 'MEDIUM' | 'HARD'>('all');
    const [isAssigning, setIsAssigning] = useState(false);

    // Auto-generate state variables
    const [totalQuestions, setTotalQuestions] = useState(10);
    const [defaultMarks, setDefaultMarks] = useState(4);
    const [defaultNegativeMarks, setDefaultNegativeMarks] = useState(1);
    const [customTagInput, setCustomTagInput] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    const [rules, setRules] = useState<Array<{
        tags: string[];
        percentage: number;
        difficultyDistribution: { EASY: number; MEDIUM: number; HARD: number };
    }>>([
        {
            tags: [],
            percentage: 100,
            difficultyDistribution: { EASY: 40, MEDIUM: 40, HARD: 20 },
        }
    ]);

    // Hooks for fetching questions and tags
    const { tags: availableTags } = useQuestionTags();
    const { questions, isLoading, autoGenerateMutation } = useQuestions({
        unassignedFor: contestId,
        search: search.trim() || undefined,
        difficulty: difficulty === 'all' ? undefined : difficulty,
        limit: 100
    });

    const { assignMutation } = useContestQuestions(contestId);

    useEffect(() => {
        if (isOpen) {
            setSelectedIds([]);
            setSearch('');
            setDifficulty('all');
            setActiveTab('manual');
            setTotalQuestions(10);
            setDefaultMarks(4);
            setDefaultNegativeMarks(1);
            setCustomTagInput('');
            setSelectedTags([]);
            setRules([
                {
                    tags: [],
                    percentage: 100,
                    difficultyDistribution: { EASY: 40, MEDIUM: 40, HARD: 20 },
                }
            ]);
        }
    }, [isOpen]);

    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const toggleSelectAll = () => {
        if (!questions) return;
        if (selectedIds.length === questions.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(questions.map((q: any) => q.id));
        }
    };

    const handleAssign = async () => {
        if (selectedIds.length === 0) return;

        setIsAssigning(true);
        try {
            const payload = selectedIds.map((questionId, idx) => ({
                questionId,
                position: currentCount + idx + 1,
                marks: defaultMarks,
                negativeMark: defaultNegativeMarks,
            }));

            await assignMutation.mutateAsync(payload);
            toast.success(`${selectedIds.length} questions added to contest`);
            onClose();
        } catch (err) {
            toast.error('Failed to add questions');
        } finally {
            setIsAssigning(false);
        }
    };

    // Auto-generate logic
    const handleToggleGlobalTag = (tag: string) => {
        setSelectedTags(prev => {
            const isSelected = prev.includes(tag);
            const nextTags = isSelected ? prev.filter(t => t !== tag) : [...prev, tag];

            // Sync rules state
            setRules(currentRules => {
                if (nextTags.length === 0) {
                    return [
                        {
                            tags: [],
                            percentage: 100,
                            difficultyDistribution: { EASY: 40, MEDIUM: 40, HARD: 20 },
                        }
                    ];
                }

                if (isSelected) {
                    // Deselected tag: remove rule and scale others
                    const filtered = currentRules.filter(r => !(r.tags.length === 1 && r.tags[0] === tag));
                    if (filtered.length === 0) {
                        return [
                            {
                                tags: [],
                                percentage: 100,
                                difficultyDistribution: { EASY: 40, MEDIUM: 40, HARD: 20 },
                            }
                        ];
                    }
                    const sum = filtered.reduce((acc, r) => acc + r.percentage, 0);
                    if (sum === 0) {
                        const share = Math.floor(100 / filtered.length);
                        return filtered.map((r, i) => ({
                            ...r,
                            percentage: i === 0 ? share + (100 - share * filtered.length) : share
                        }));
                    }
                    const scaled = filtered.map(r => ({
                        ...r,
                        percentage: Math.round((r.percentage / sum) * 100)
                    }));
                    // adjust rounding
                    const scaledSum = scaled.reduce((acc, r) => acc + r.percentage, 0);
                    const diff = 100 - scaledSum;
                    if (diff !== 0 && scaled.length > 0) {
                        scaled[0].percentage += diff;
                    }
                    return scaled;
                } else {
                    // Selected tag: add new rule and scale others
                    const cleanedRules = currentRules.filter(r => r.tags.length > 0);

                    const newRule = {
                        tags: [tag],
                        percentage: 0,
                        difficultyDistribution: { EASY: 40, MEDIUM: 40, HARD: 20 },
                    };

                    if (cleanedRules.length === 0) {
                        newRule.percentage = 100;
                        return [newRule];
                    }

                    const n = cleanedRules.length;
                    const newShare = Math.max(5, Math.floor(100 / (n + 1)));
                    const remaining = 100 - newShare;
                    const oldSum = cleanedRules.reduce((acc, r) => acc + r.percentage, 0);

                    const scaled = cleanedRules.map(r => ({
                        ...r,
                        percentage: oldSum > 0 ? Math.round((r.percentage / oldSum) * remaining) : Math.floor(remaining / n)
                    }));

                    // Adjust rounding
                    const scaledSum = scaled.reduce((acc, r) => acc + r.percentage, 0);
                    newRule.percentage = 100 - scaledSum;

                    return [...scaled, newRule];
                }
            });

            return nextTags;
        });
    };

    const handleAddGlobalCustomTag = () => {
        const tag = (customTagInput || '').trim();
        if (!tag) return;
        if (selectedTags.includes(tag)) {
            setCustomTagInput('');
            return;
        }

        setSelectedTags(prev => [...prev, tag]);
        setRules(currentRules => {
            const cleanedRules = currentRules.filter(r => r.tags.length > 0);
            const newRule = {
                tags: [tag],
                percentage: 0,
                difficultyDistribution: { EASY: 40, MEDIUM: 40, HARD: 20 },
            };

            if (cleanedRules.length === 0) {
                newRule.percentage = 100;
                return [newRule];
            }

            const n = cleanedRules.length;
            const newShare = Math.max(5, Math.floor(100 / (n + 1)));
            const remaining = 100 - newShare;
            const oldSum = cleanedRules.reduce((acc, r) => acc + r.percentage, 0);

            const scaled = cleanedRules.map(r => ({
                ...r,
                percentage: oldSum > 0 ? Math.round((r.percentage / oldSum) * remaining) : Math.floor(remaining / n)
            }));

            const scaledSum = scaled.reduce((acc, r) => acc + r.percentage, 0);
            newRule.percentage = 100 - scaledSum;

            return [...scaled, newRule];
        });

        setCustomTagInput('');
    };

    const handleRemoveRule = (index: number) => {
        if (rules.length <= 1) return;
        const ruleToRemove = rules[index];
        if (ruleToRemove && ruleToRemove.tags.length === 1) {
            const removedTag = ruleToRemove.tags[0];
            setSelectedTags(prev => prev.filter(t => t !== removedTag));
        }

        setRules(prev => {
            const filtered = prev.filter((_, i) => i !== index);
            const currentSum = filtered.reduce((sum, r) => sum + r.percentage, 0);
            if (currentSum === 0) {
                const share = Math.floor(100 / filtered.length);
                return filtered.map((r, i) => ({
                    ...r,
                    percentage: i === 0 ? share + (100 - share * filtered.length) : share
                }));
            }
            // Scale remaining rules to fill the gap
            const scaled = filtered.map(r => ({
                ...r,
                percentage: Math.round((r.percentage / currentSum) * 100)
            }));

            // Adjust any rounding errors
            const scaledSum = scaled.reduce((sum, r) => sum + r.percentage, 0);
            const diff = 100 - scaledSum;
            if (diff !== 0 && scaled.length > 0) {
                scaled[0]!.percentage += diff;
            }
            return scaled;
        });
    };

    const handleUpdateRule = (index: number, fields: Partial<typeof rules[0]>) => {
        setRules(prev => prev.map((r, i) => i === index ? { ...r, ...fields } : r));
    };

    const handleUpdateRulePercentage = (index: number, newPercentage: number) => {
        setRules(prev => {
            const percentages = prev.map(r => r.percentage);
            const adjusted = adjustPercentages(percentages, index, newPercentage, 100);
            return prev.map((r, i) => ({
                ...r,
                percentage: adjusted[i]!
            }));
        });
    };

    const handleUpdateDifficulty = (ruleIndex: number, level: 'EASY' | 'MEDIUM' | 'HARD', newValue: number) => {
        setRules(prev => prev.map((rule, idx) => {
            if (idx !== ruleIndex) return rule;

            const levels: Array<'EASY' | 'MEDIUM' | 'HARD'> = ['EASY', 'MEDIUM', 'HARD'];
            const values = levels.map(l => rule.difficultyDistribution[l]);
            const changedIndex = levels.indexOf(level);

            const adjusted = adjustPercentages(values, changedIndex, newValue, 100);

            return {
                ...rule,
                difficultyDistribution: {
                    EASY: adjusted[0]!,
                    MEDIUM: adjusted[1]!,
                    HARD: adjusted[2]!
                }
            };
        }));
    };

    const totalRulePercentage = rules.reduce((sum, r) => sum + r.percentage, 0);
    const isRulePercentageValid = totalRulePercentage === 100;

    const isDiffBreakdownValid = rules.every(r =>
        (r.difficultyDistribution.EASY + r.difficultyDistribution.MEDIUM + r.difficultyDistribution.HARD) === 100
    );

    const isAutoFormValid = totalQuestions > 0 && isRulePercentageValid && isDiffBreakdownValid && rules.length > 0;

    const handleAutoGenerate = async () => {
        if (!isAutoFormValid) return;

        setIsAssigning(true);
        try {
            const result = await autoGenerateMutation.mutateAsync({
                contestId,
                body: {
                    totalQuestions,
                    defaultMarks,
                    defaultNegativeMarks,
                    rules
                }
            });

            toast.success(result.message || `Successfully auto-generated and assigned ${result.data?.assignedCount || totalQuestions} questions!`);
            onClose();
        } catch (err: any) {
            const errMsg = err?.response?.data?.message || err?.message || 'Failed to auto-generate questions';
            toast.error(errMsg);
        } finally {
            setIsAssigning(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-full max-w-[92vw] max-h-[92vh] min-h-[60vh] flex flex-col p-0 overflow-hidden border border-border/80 shadow-2xl bg-background/95 backdrop-blur-xl">
                {/* Header Section */}
                <div className="px-6 pt-5 pb-4 border-b bg-muted/20">
                    <DialogHeader>
                        <div className="flex items-center gap-2">
                            <div className="p-2 rounded-xl bg-primary/10 text-primary">
                                <Sparkles className="h-5 w-5 animate-pulse" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl font-bold tracking-tight">Question Pool Selector</DialogTitle>
                                <DialogDescription className="text-xs mt-0.5">
                                    Assign questions to your contest manually or auto-generate sets dynamically using rules.
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Sliding Tab Selector */}
                    <div className="flex p-1 mt-4 rounded-xl bg-muted/60 border border-muted/80 max-w-sm relative">
                        <button
                            type="button"
                            onClick={() => setActiveTab('manual')}
                            className={cn(
                                "flex-1 py-1 text-xs font-bold transition-all rounded-lg z-10 flex items-center justify-center gap-1.5",
                                activeTab === 'manual' ? "text-primary-foreground font-extrabold" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Sliders className="h-3.5 w-3.5" />
                            Pick Manually
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('auto')}
                            className={cn(
                                "flex-1 py-1 text-xs font-bold transition-all rounded-lg z-10 flex items-center justify-center gap-1.5",
                                activeTab === 'auto' ? "text-primary-foreground font-extrabold" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Dices className="h-3.5 w-3.5" />
                            Auto-Generate Set
                            <Badge className="ml-1 px-1 py-0 bg-primary-foreground text-primary text-[8px] scale-95 border-none font-bold">New</Badge>
                        </button>

                        <motion.div
                            layoutId="activeTabIndicator"
                            className="absolute inset-y-1 rounded-lg bg-primary shadow-sm"
                            style={{
                                width: 'calc(50% - 4px)',
                                left: activeTab === 'manual' ? '4px' : 'calc(50%)'
                            }}
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                    </div>
                </div>

                {/* Content Body Container */}
                <div className="flex-1 overflow-y-auto lg:overflow-hidden px-6 py-4 min-h-0">
                    <AnimatePresence mode="wait">
                        {activeTab === 'manual' ? (
                            <motion.div
                                key="manual"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.15 }}
                                className="space-y-4"
                            >
                                {/* Filters */}
                                <div className="flex flex-col sm:flex-row gap-3 pb-3 border-b border-border/40">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by question text..."
                                            className="pl-9 h-9"
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                        />
                                    </div>
                                    <div className="flex gap-1">
                                        {(['all', 'EASY', 'MEDIUM', 'HARD'] as const).map((level) => (
                                            <Button
                                                key={level}
                                                variant={difficulty === level ? 'default' : 'outline'}
                                                size="sm"
                                                className="text-xs uppercase font-semibold h-9"
                                                onClick={() => setDifficulty(level)}
                                            >
                                                {level === 'all' ? 'All' : level}
                                            </Button>
                                        ))}
                                    </div>
                                </div>

                                {/* List */}
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-20 gap-3">
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                        <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading unassigned questions...</p>
                                    </div>
                                ) : !questions || questions.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                                            <Search className="h-6 w-6 text-muted-foreground/30" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-base">No unassigned questions found</p>
                                            <p className="text-sm text-muted-foreground mt-0.5">
                                                All question bank items might already be in the contest, or try another search query.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="divide-y border rounded-xl overflow-hidden bg-muted/10">
                                        <div className="flex items-center px-4 py-3 bg-muted/40 font-semibold text-xs text-muted-foreground border-b">
                                            <div className="w-10 flex justify-center">
                                                <Checkbox
                                                    checked={selectedIds.length === questions.length && questions.length > 0}
                                                    onCheckedChange={toggleSelectAll}
                                                />
                                            </div>
                                            <div className="flex-1 ml-2">QUESTION TEXT</div>
                                            <div className="w-28 text-center">DIFFICULTY</div>
                                            <div className="w-28 text-center">TAGS</div>
                                        </div>
                                        <div className="divide-y">
                                            {questions.map((q: any) => (
                                                <div
                                                    key={q.id}
                                                    onClick={() => toggleSelect(q.id)}
                                                    className={cn(
                                                        "flex items-center px-4 py-3 cursor-pointer transition-colors hover:bg-muted/30",
                                                        selectedIds.includes(q.id) && "bg-primary/5 hover:bg-primary/10"
                                                    )}
                                                >
                                                    <div className="w-10 flex justify-center" onClick={(e) => e.stopPropagation()}>
                                                        <Checkbox
                                                            checked={selectedIds.includes(q.id)}
                                                            onCheckedChange={() => toggleSelect(q.id)}
                                                        />
                                                    </div>
                                                    <div className="flex-1 min-w-0 font-medium text-sm ml-2 pr-4 truncate">
                                                        {q.questionText}
                                                    </div>
                                                    <div className="w-28 text-center">
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] font-bold uppercase tracking-wider",
                                                            q.difficulty === 'EASY' ? "text-green-600 border-green-500/20 bg-green-500/5" :
                                                                q.difficulty === 'MEDIUM' ? "text-amber-600 border-amber-500/20 bg-amber-500/5" :
                                                                    "text-destructive border-destructive/20 bg-destructive/5"
                                                        )}>
                                                            {q.difficulty}
                                                        </Badge>
                                                    </div>
                                                    <div className="w-28 text-center truncate">
                                                        <span className="text-xs text-muted-foreground">{q.tags?.slice(0, 1).join(', ') || '—'}</span>
                                                        {q.tags?.length > 1 && <span className="text-[10px] text-muted-foreground/60 ml-1">+{q.tags.length - 1}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="auto"
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -5 }}
                                transition={{ duration: 0.15 }}
                                className="h-full min-h-0 overflow-hidden"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-0 overflow-hidden">
                                    {/* Left Column: General Configuration (5 cols) */}
                                    <div className="lg:col-span-5 flex flex-col gap-4 overflow-y-auto pr-1 h-full pb-4">
                                        {/* Card 1: Configuration Fields */}
                                        <div className="p-4 rounded-xl border bg-muted/10 space-y-4">
                                            <div className="flex items-center gap-2 border-b pb-2">
                                                <Sliders className="h-4 w-4 text-primary" />
                                                <span className="font-bold text-sm tracking-tight">Global Parameters</span>
                                            </div>

                                            {/* Total Questions Counter */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Questions</Label>
                                                    <span className="text-xs font-extrabold text-primary">{totalQuestions} questions</span>
                                                </div>
                                                <div className="flex items-center gap-2 bg-background border rounded-lg p-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:bg-muted font-extrabold text-foreground"
                                                        onClick={() => setTotalQuestions(prev => Math.max(1, prev - 1))}
                                                    >
                                                        -
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        max={500}
                                                        className="h-8 border-none text-center font-extrabold text-sm focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground"
                                                        value={totalQuestions}
                                                        onChange={(e) => setTotalQuestions(Math.max(1, parseInt(e.target.value) || 1))}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:bg-muted font-extrabold text-foreground"
                                                        onClick={() => setTotalQuestions(prev => Math.min(500, prev + 1))}
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                                <p className="text-[9px] text-muted-foreground">Total pool size to dynamically auto-generate.</p>
                                            </div>

                                            {/* Default Marks */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Marks Per Question</Label>
                                                    <span className="text-xs font-bold text-emerald-600">+{defaultMarks} pts</span>
                                                </div>
                                                <div className="flex items-center gap-2 bg-background border rounded-lg p-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:bg-muted font-extrabold text-foreground"
                                                        onClick={() => setDefaultMarks(prev => Math.max(1, prev - 1))}
                                                    >
                                                        -
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        min={1}
                                                        className="h-8 border-none text-center font-bold text-sm focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground"
                                                        value={defaultMarks}
                                                        onChange={(e) => setDefaultMarks(Math.max(1, parseInt(e.target.value) || 1))}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:bg-muted font-extrabold text-foreground"
                                                        onClick={() => setDefaultMarks(prev => prev + 1)}
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                                <p className="text-[9px] text-muted-foreground">Default marks value assigned for correct answer.</p>
                                            </div>

                                            {/* Negative Marks */}
                                            <div className="space-y-1.5">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Negative Penalty</Label>
                                                    <span className="text-xs font-bold text-destructive font-semibold">-{defaultNegativeMarks} pts</span>
                                                </div>
                                                <div className="flex items-center gap-2 bg-background border rounded-lg p-1">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:bg-muted font-extrabold text-foreground"
                                                        onClick={() => setDefaultNegativeMarks(prev => Math.max(0, prev - 1))}
                                                    >
                                                        -
                                                    </Button>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        className="h-8 border-none text-center font-bold text-sm focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent flex-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground"
                                                        value={defaultNegativeMarks}
                                                        onChange={(e) => setDefaultNegativeMarks(Math.max(0, parseInt(e.target.value) || 0))}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 hover:bg-muted font-extrabold text-foreground"
                                                        onClick={() => setDefaultNegativeMarks(prev => prev + 1)}
                                                    >
                                                        +
                                                    </Button>
                                                </div>
                                                <p className="text-[9px] text-muted-foreground">Deducted marks for incorrect answers.</p>
                                            </div>
                                        </div>

                                        {/* Card 2: Target Topics / Modules */}
                                        <div className="p-4 rounded-xl border bg-muted/10 space-y-4">
                                            <div className="flex items-center gap-2 border-b pb-2">
                                                <Filter className="h-4 w-4 text-primary" />
                                                <span className="font-bold text-sm tracking-tight">Select Topics / Modules</span>
                                            </div>

                                            {/* Checklist Badge Stream */}
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Library Question Topics</Label>
                                                {availableTags.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg bg-background max-h-[120px] overflow-y-auto">
                                                        {availableTags.map((tag: string) => {
                                                            const isSelected = selectedTags.includes(tag);
                                                            return (
                                                                <button
                                                                    key={tag}
                                                                    type="button"
                                                                    onClick={() => handleToggleGlobalTag(tag)}
                                                                    className={cn(
                                                                        "px-2.5 py-0.5 rounded-full text-[10px] font-extrabold transition-all border select-none",
                                                                        isSelected
                                                                            ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/20 scale-95"
                                                                            : "bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:bg-muted/70"
                                                                    )}
                                                                >
                                                                    {tag}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <p className="text-[10px] text-muted-foreground italic">No question tags found in library. Type custom modules below.</p>
                                                )}
                                            </div>

                                            {/* Custom tag addition */}
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Add Custom Module Name</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        placeholder="e.g. System Design, Spring Boot..."
                                                        className="h-8 text-xs max-w-xs text-foreground bg-background"
                                                        value={customTagInput}
                                                        onChange={(e) => setCustomTagInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                e.preventDefault();
                                                                handleAddGlobalCustomTag();
                                                            }
                                                        }}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-8 px-3 font-bold text-xs shrink-0 bg-background hover:bg-muted"
                                                        onClick={handleAddGlobalCustomTag}
                                                    >
                                                        Add
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card 3: Visualizer and Validation warnings */}
                                        <div className="p-4 rounded-xl border bg-muted/10 space-y-4">
                                            <div className="flex items-center justify-between border-b pb-2">
                                                <div className="flex items-center gap-2">
                                                    <Layers className="h-4 w-4 text-primary" />
                                                    <span className="font-bold text-sm tracking-tight">Allocation Summary</span>
                                                </div>
                                                <Badge
                                                    variant="outline"
                                                    className={cn(
                                                        "font-extrabold text-[10px] px-2 py-0.5 tracking-wider",
                                                        isRulePercentageValid
                                                            ? "text-green-600 border-green-500/20 bg-green-500/5"
                                                            : "text-destructive border-destructive/20 bg-destructive/5"
                                                    )}
                                                >
                                                    {totalRulePercentage}% / 100%
                                                </Badge>
                                            </div>

                                            {/* Segmented Rule Distribution Visualizer */}
                                            <div className="space-y-1.5">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Dynamic Rule Balance</span>
                                                <div className="h-3 rounded-full overflow-hidden flex w-full bg-muted border">
                                                    {rules.map((r, i) => (
                                                        <TooltipProvider key={i}>
                                                            <Tooltip delayDuration={100}>
                                                                <TooltipTrigger asChild>
                                                                    <div
                                                                        style={{ width: `${r.percentage}%` }}
                                                                        className={cn("h-full transition-all duration-150 cursor-help",
                                                                            i === 0 ? "bg-primary" :
                                                                                i === 1 ? "bg-violet-500" :
                                                                                    i === 2 ? "bg-indigo-500" :
                                                                                        i === 3 ? "bg-fuchsia-500" : "bg-teal-500"
                                                                        )}
                                                                    />
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p className="font-bold text-xs">Rule {i + 1}: {r.percentage}%</p>
                                                                    <p className="text-[10px] text-muted-foreground">{r.tags.length > 0 ? `Topic: ${r.tags.join(', ')}` : 'All Questions'}</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    ))}
                                                </div>
                                                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                                                    {rules.map((r, i) => (
                                                        <div key={i} className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground">
                                                            <div className={cn("h-1.5 w-1.5 rounded-full",
                                                                i === 0 ? "bg-primary" :
                                                                    i === 1 ? "bg-violet-500" :
                                                                        i === 2 ? "bg-indigo-500" :
                                                                            i === 3 ? "bg-fuchsia-500" : "bg-teal-500"
                                                            )} />
                                                            Rule {i + 1} ({r.percentage}%)
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Validation feedback block */}
                                            <div className="space-y-2 pt-1">
                                                {isRulePercentageValid ? (
                                                    <div className="flex gap-2 p-2.5 rounded-lg border border-green-500/20 bg-green-500/5 text-green-700 text-xs items-start">
                                                        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
                                                        <div>
                                                            <p className="font-bold">Allocations Balanced</p>
                                                            <p className="opacity-90 mt-0.5 font-semibold">Pool rules sum up to exactly 100%.</p>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex gap-2 p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive text-xs items-start">
                                                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
                                                        <div>
                                                            <p className="font-bold">Invalid Allocation Weight</p>
                                                            <p className="opacity-90 mt-0.5 font-semibold">
                                                                Rules total {totalRulePercentage}%. Adjust sliders to sum to exactly 100%.
                                                            </p>
                                                        </div>
                                                    </div>
                                                )}

                                                {!isDiffBreakdownValid && (
                                                    <div className="flex gap-2 p-2.5 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive text-xs items-start">
                                                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                                        <div>
                                                            <p className="font-bold">Difficulty Mismatch</p>
                                                            <p className="opacity-90 mt-0.5 font-semibold">Check that all individual rules' difficulty distributions sum to 100%.</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Rules Stack (7 cols) */}
                                    <div className="lg:col-span-7 flex flex-col h-full min-h-0 overflow-hidden">
                                        <div className="flex-1 overflow-y-auto pr-2 space-y-4 pb-4">
                                            {rules.map((rule, idx) => {
                                                const ruleQty = Math.round(totalQuestions * rule.percentage / 100);
                                                const ruleDiffSum = rule.difficultyDistribution.EASY + rule.difficultyDistribution.MEDIUM + rule.difficultyDistribution.HARD;
                                                const isDiffValid = ruleDiffSum === 100;
                                                const ruleTopicName = rule.tags.length > 0 ? rule.tags[0] : "All Questions";

                                                return (
                                                    <div
                                                        key={idx}
                                                        className="p-4 rounded-xl border border-border/80 bg-card shadow-sm space-y-4 hover:border-primary/20 transition-all relative group"
                                                    >
                                                        {/* Rule Header */}
                                                        <div className="flex items-center justify-between border-b pb-2">
                                                            <div className="flex items-center gap-2">
                                                                <div className={cn("h-6 w-6 rounded-full font-bold text-xs flex items-center justify-center text-white",
                                                                    idx === 0 ? "bg-primary" :
                                                                        idx === 1 ? "bg-violet-500" :
                                                                            idx === 2 ? "bg-indigo-500" :
                                                                                idx === 3 ? "bg-fuchsia-500" : "bg-teal-500"
                                                                )}>
                                                                    {idx + 1}
                                                                </div>
                                                                <span className="font-extrabold text-xs md:text-sm text-foreground capitalize">
                                                                    {ruleTopicName} Pool
                                                                </span>
                                                                <Badge variant="secondary" className="font-bold text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-none">
                                                                    {ruleQty} Question(s)
                                                                </Badge>
                                                            </div>
                                                            {rules.length > 1 && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
                                                                    onClick={() => handleRemoveRule(idx)}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>

                                                        {/* Space-efficient two-column layout for Allocation and Difficulty */}
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-3">
                                                            {/* Left column: Allocation Pool Share */}
                                                            <div className="space-y-3 flex flex-col justify-center">
                                                                <div className="flex items-center justify-between text-xs font-bold text-foreground">
                                                                    <span>Allocation Pool Share</span>
                                                                    <span className="text-primary font-extrabold">{rule.percentage}% of total</span>
                                                                </div>
                                                                <div className="flex items-center gap-3">
                                                                    <Slider
                                                                        value={[rule.percentage]}
                                                                        onValueChange={([val]) => handleUpdateRulePercentage(idx, val)}
                                                                        min={0}
                                                                        max={100}
                                                                        className="flex-1"
                                                                    />
                                                                    <div className="flex items-center bg-background border rounded-lg px-2 py-0.5 shrink-0">
                                                                        <Input
                                                                            type="number"
                                                                            min={0}
                                                                            max={100}
                                                                            className="w-10 h-7 p-0 border-none text-center text-xs font-extrabold focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-foreground"
                                                                            value={rule.percentage}
                                                                            onChange={(e) => handleUpdateRulePercentage(idx, Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                                                        />
                                                                        <span className="text-xs font-bold text-muted-foreground">%</span>
                                                                    </div>
                                                                </div>
                                                                <p className="text-[10px] text-muted-foreground/80 leading-relaxed italic">
                                                                    This pool contributes approximately <strong>{ruleQty}</strong> of the <strong>{totalQuestions}</strong> total questions.
                                                                </p>
                                                            </div>

                                                            {/* Right column: Difficulty distribution */}
                                                            <div className="space-y-3 md:border-l md:pl-6">
                                                                <div className="flex items-center justify-between">
                                                                    <Label className="text-xs font-bold text-foreground">Difficulty distribution (%)</Label>
                                                                    <div className="flex items-center gap-2">
                                                                        <button
                                                                            type="button"
                                                                            className="text-[10px] text-primary font-extrabold hover:underline"
                                                                            onClick={() => handleUpdateRule(idx, {
                                                                                difficultyDistribution: { EASY: 34, MEDIUM: 33, HARD: 33 }
                                                                            })}
                                                                        >
                                                                            Equalize
                                                                        </button>
                                                                        <span className="text-[10px] text-muted-foreground">|</span>
                                                                        <button
                                                                            type="button"
                                                                            className="text-[10px] text-primary font-extrabold hover:underline"
                                                                            onClick={() => handleUpdateRule(idx, {
                                                                                difficultyDistribution: { EASY: 40, MEDIUM: 40, HARD: 20 }
                                                                            })}
                                                                        >
                                                                            Default
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Segmented difficulty visual preview bar */}
                                                                <div className="h-2 rounded-full overflow-hidden flex w-full bg-muted border">
                                                                    <div style={{ width: `${rule.difficultyDistribution.EASY}%` }} className="bg-green-500 transition-all duration-150" />
                                                                    <div style={{ width: `${rule.difficultyDistribution.MEDIUM}%` }} className="bg-amber-500 transition-all duration-150" />
                                                                    <div style={{ width: `${rule.difficultyDistribution.HARD}%` }} className="bg-red-500 transition-all duration-150" />
                                                                </div>

                                                                {/* Linked Difficulty Sliders & Inputs */}
                                                                <div className="space-y-2">
                                                                    {(['EASY', 'MEDIUM', 'HARD'] as const).map((level) => {
                                                                        const val = rule.difficultyDistribution[level];
                                                                        const labelColor = level === 'EASY' ? 'text-green-600' : level === 'MEDIUM' ? 'text-amber-600' : 'text-red-600';

                                                                        return (
                                                                            <div key={level} className="flex items-center gap-3">
                                                                                <span className={cn("text-[9px] font-extrabold w-12 uppercase", labelColor)}>{level}</span>
                                                                                <Slider
                                                                                    value={[val]}
                                                                                    onValueChange={([newVal]) => handleUpdateDifficulty(idx, level, newVal)}
                                                                                    min={0}
                                                                                    max={100}
                                                                                    className="flex-1"
                                                                                />
                                                                                <div className="flex items-center bg-background border rounded-lg px-1.5 py-0.5 shrink-0">
                                                                                    <Input
                                                                                        type="number"
                                                                                        min={0}
                                                                                        max={100}
                                                                                        className={cn("w-8 h-6 p-0 border-none text-center text-xs font-extrabold focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none", labelColor)}
                                                                                        value={val}
                                                                                        onChange={(e) => handleUpdateDifficulty(idx, level, Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                                                                                    />
                                                                                    <span className="text-[10px] font-bold text-muted-foreground">%</span>
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                             </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <div className="pt-2 border-t text-center">
                                            <p className="text-[10px] text-muted-foreground italic flex items-center justify-center gap-1">
                                                <span>💡 Tip: Select tags from the left panel to spawn matching allocation pools. Customize percentages to balance them to exactly 100%.</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Shared Action Dialog Footer */}
                <div className="px-6 py-4 border-t bg-muted/10 flex items-center justify-end gap-2 shrink-0">
                    <Button variant="ghost" onClick={onClose} disabled={isAssigning}>Cancel</Button>
                    {activeTab === 'manual' ? (
                        <Button
                            onClick={handleAssign}
                            disabled={selectedIds.length === 0 || isAssigning}
                            className="px-6 font-bold"
                        >
                            {isAssigning ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Assigning...
                                </>
                            ) : (
                                `Add Selected (${selectedIds.length})`
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={handleAutoGenerate}
                            disabled={!isAutoFormValid || isAssigning}
                            className={cn(
                                "px-6 font-bold relative overflow-hidden group shadow-md transition-all active:scale-95",
                                isAutoFormValid ? "bg-gradient-to-r from-primary to-violet-600 hover:from-primary/90 hover:to-violet-600/90 text-white" : ""
                            )}
                        >
                            {isAssigning ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Generating Set...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4 animate-pulse" />
                                    Auto Generate Set
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
