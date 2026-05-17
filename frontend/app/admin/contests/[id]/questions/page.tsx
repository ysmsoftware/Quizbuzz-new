'use client';

import { useState, useMemo } from 'react';
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
  CheckCircle2,
  Info,
  ChevronDown,
  ArrowRight,
  Download,
  FileJson,
  FileSpreadsheet,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useContestDetail } from '@/lib/hooks/useContestDetail';
import { useContestQuestions } from '@/lib/hooks/useContestQuestions';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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

export default function QuestionsTabPage() {
  const { id } = useParams() as { id: string };
  const { data: contest } = useContestDetail(id);
  const { 
    data: questions, 
    isLoading, 
    deleteQuestion, 
    duplicateQuestion,
    bulkUpdateQuestions
  } = useContestQuestions(id);

  const [searchQuery, setSearchQuery] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<'all' | DifficultyLevel>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

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
            <Button className="bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Plus className="mr-2 h-4 w-4" />
              Add Question
            </Button>
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
                  <th className="w-24 px-4 py-3 text-center">Options</th>
                  <th className="w-20 px-4 py-3 text-center">Hint</th>
                  <th className="px-4 py-3 text-left">Tags</th>
                  <th className="w-24 px-4 py-3 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {filteredQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                          <Search className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-lg">No questions found</p>
                          <p className="text-muted-foreground text-sm">Try adjusting your filters or search query.</p>
                        </div>
                        {canAdd && (
                          <Button variant="outline" size="sm" className="mt-2" onClick={() => toast.info("Add first question logic here")}>
                            Add First Question
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredQuestions.map((q, idx) => (
                    <motion.tr 
                      key={q.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={cn(
                        "group hover:bg-muted/30 transition-colors",
                        selectedIds.includes(q.id) && "bg-primary/5"
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
                      <td className="px-4 py-4 font-medium max-w-[300px] truncate">
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
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {isLive ? (
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <Eye className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-primary">
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit Question</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
  
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8"
                                onClick={() => duplicateQuestion(q)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
  
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-8 w-8 text-destructive"
                                      disabled={!canDelete}
                                      onClick={() => deleteQuestion(q.id)}
                                    >
                                      <Trash2 className={cn("h-4 w-4", !canDelete && "opacity-30")} />
                                    </Button>
                                  </TooltipTrigger>
                                  {!canDelete && (
                                    <TooltipContent>
                                      Deleting questions after publishing affects registered participants
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
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
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════
// ImportCSVModal Component
// ═══════════════════════════════════════════════════════

function ImportCSVModal({ isOpen, onClose, contestId }: { isOpen: boolean; onClose: () => void; contestId: string }) {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview'>('upload');
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleImport = async () => {
    setIsImporting(true);
    // Simulated import progress
    for (let i = 0; i <= 100; i += 10) {
      setProgress(i);
      await new Promise(r => setTimeout(r, 100));
    }
    setIsImporting(false);
    toast.success('Questions imported successfully!');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Questions</DialogTitle>
          <DialogDescription>
            Import questions from a CSV or JSON file. Follow our template for best results.
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6 py-6">
            <div className="flex flex-col items-center justify-center h-[200px] border-2 border-dashed rounded-2xl bg-muted/20 hover:bg-muted/30 transition-colors cursor-pointer">
              <Upload className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium">Drag CSV file here or click to browse</p>
              <p className="text-xs text-muted-foreground mt-1">Accepts .csv, .json (Max 50MB)</p>
            </div>
            
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
              <Button size="sm" variant="outline">Download CSV</Button>
            </div>
          </div>
        )}

        {isImporting && (
          <div className="space-y-4 py-8">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Importing 24 questions...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button onClick={() => setStep('preview')}>Continue to Preview</Button>
          )}
          {step === 'preview' && (
            <div className="flex gap-3 w-full">
              <Button variant="ghost" onClick={() => setStep('upload')}>Back</Button>
              <Button className="flex-1" onClick={handleImport} disabled={isImporting}>
                Import 24 Questions
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
