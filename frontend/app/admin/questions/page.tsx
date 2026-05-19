'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Eye,
  HelpCircle,
  Search,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Layers,
  BookOpen,
  Filter,
  Sparkles,
  Info,
  ShieldCheck,
} from 'lucide-react';
import { useQuestions, useQuestion } from '@/lib/hooks/useQuestions';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import QuestionQuestionsListComponent from '@/components/questions/QuestionQuestionsListComponent';

export default function QuestionsPage() {
  const router = useRouter();
  
  // Search and Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  
  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // In-place expanded question ID state for concise inline inspection
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);

  // Modals state
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Reset pagination page and collapse open cards when filters change
  useEffect(() => {
    setCurrentPage(1);
    setExpandedQuestionId(null);
  }, [searchTerm, difficulty, pageSize]);

  // Fetch paginated data
  const {
    questions = [],
    pagination,
    isLoading: isListLoading,
    isFetching: isListFetching,
    updateQuestionMutation,
    deleteQuestionMutation,
  } = useQuestions({
    search: searchTerm,
    difficulty: difficulty === 'all' ? undefined : difficulty,
    page: currentPage,
    limit: pageSize,
  });

  const activeQuestionId = isViewModalOpen ? selectedQuestionId : (isEditModalOpen ? editingQuestionId : null);
  const { question: detailedQuestion, isLoading: isDetailLoading } = useQuestion(activeQuestionId);

  const displayQuestion = detailedQuestion || questions.find((q: any) => q.id === (selectedQuestionId || editingQuestionId));

  const [editForm, setEditForm] = useState<{
    questionText: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    category: string;
    hint: string;
    explanation: string;
    options: { id: string; text: string; isCorrect: boolean }[];
  }>({
    questionText: '',
    difficulty: 'MEDIUM',
    category: 'General',
    hint: '',
    explanation: '',
    options: [],
  });

  useEffect(() => {
    if (isEditModalOpen && detailedQuestion && detailedQuestion.id === editingQuestionId) {
      setEditForm({
        questionText: detailedQuestion.questionText || '',
        difficulty: detailedQuestion.difficulty || 'MEDIUM',
        category: detailedQuestion.tags?.[0] || 'General',
        hint: detailedQuestion.hint || '',
        explanation: detailedQuestion.explanation || '',
        options: detailedQuestion.options?.map((o: any) => ({
          id: o.id || Math.random().toString(),
          text: o.text || '',
          isCorrect: !!o.isCorrect,
        })) || [],
      });
    }
  }, [detailedQuestion, isEditModalOpen, editingQuestionId]);

  const handleEditOptionChange = (id: string, text: string) => {
    setEditForm((f) => ({
      ...f,
      options: f.options.map((o) => (o.id === id ? { ...o, text } : o)),
    }));
  };

  const handleEditCorrectToggle = (id: string) => {
    setEditForm((f) => ({
      ...f,
      options: f.options.map((o) => ({ ...o, isCorrect: o.id === id })),
    }));
  };

  const handleEditAddOption = () => {
    if (editForm.options.length >= 6) return;
    setEditForm((f) => ({
      ...f,
      options: [...f.options, { id: Math.random().toString(), text: '', isCorrect: false }],
    }));
  };

  const handleEditRemoveOption = (id: string) => {
    if (editForm.options.length <= 2) return;
    setEditForm((f) => ({
      ...f,
      options: f.options.filter((o) => o.id !== id),
    }));
  };

  const [isSaving, setIsSaving] = useState(false);
  const handleUpdate = async () => {
    if (!editForm.questionText.trim()) {
      toast.error('Question text is required');
      return;
    }
    if (editForm.questionText.trim().length < 5) {
      toast.error('Question text must be at least 5 characters');
      return;
    }
    const hasCorrect = editForm.options.some((o) => o.isCorrect);
    if (!hasCorrect) {
      toast.error('Mark one option as the correct answer');
      return;
    }
    const emptyOptions = editForm.options.filter((o) => !o.text.trim());
    if (emptyOptions.length > 0) {
      toast.error('All option fields must be filled in');
      return;
    }

    setIsSaving(true);
    try {
      await updateQuestionMutation.mutateAsync({
        questionId: editingQuestionId!,
        body: {
          questionText: editForm.questionText.trim(),
          difficulty: editForm.difficulty,
          tags: editForm.category ? [editForm.category] : ['General'],
          hint: editForm.hint.trim() || undefined,
          explanation: editForm.explanation.trim() || undefined,
          options: editForm.options.map((o, idx) => ({
            text: o.text.trim(),
            isCorrect: o.isCorrect,
            position: idx,
          })),
        },
      });
      toast.success('Question updated successfully!');
      setIsEditModalOpen(false);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update question');
    } finally {
      setIsSaving(false);
    }
  };

  const [isDeleting, setIsDeleting] = useState(false);
  const handleDelete = async () => {
    if (!deletingQuestionId) return;
    setIsDeleting(true);
    try {
      await deleteQuestionMutation.mutateAsync(deletingQuestionId);
      toast.success('Question deleted successfully!');
      setIsDeleteDialogOpen(false);
      setExpandedQuestionId(null);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to delete question');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedQuestionId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="relative min-h-screen bg-background overflow-x-hidden">
      {/* Antigravity Deep Ambient Glow Spots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-15%] left-[-10%] w-[55vw] h-[55vw] rounded-full bg-primary/6 blur-[130px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[55vw] h-[55vw] rounded-full bg-accent/6 blur-[130px]" />
      </div>

      <div className="relative z-10 font-sans">
        {/* Floating Glassmorphic Header */}
        <header className="sticky top-0 z-50 border-b border-border/40 bg-background/70 backdrop-blur-xl transition-all duration-300">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Link 
              href="/admin" 
              className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group text-sm font-medium"
            >
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back</span>
            </Link>
            
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary p-2 rounded-xl">
                <Layers className="h-5 w-5" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Question Bank
              </h1>
            </div>

            <Link href="/admin/questions/create">
              <Button size="sm" className="gap-2 bg-primary hover:bg-primary/95 text-primary-foreground shadow-md shadow-primary/10 hover:shadow-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all duration-300 rounded-xl">
                <Plus className="h-4 w-4" />
                New Question
              </Button>
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
          
          {/* Stats Summary Showcase (Premium touch) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Questions Card */}
            <div className="bg-card/45 border border-border/40 backdrop-blur-md p-5 rounded-2xl flex items-center gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 shadow-sm">
              <div className="bg-primary/10 text-primary p-3 rounded-xl">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Total Bank Size</p>
                <p className="text-2xl font-extrabold tracking-tight mt-0.5">
                  {isListLoading ? (
                    <span className="inline-block h-7 w-12 bg-muted animate-pulse rounded-md" />
                  ) : (
                    pagination?.total ?? 0
                  )}
                </p>
              </div>
            </div>

            {/* Active Filter Card */}
            <div className="bg-card/45 border border-border/40 backdrop-blur-md p-5 rounded-2xl flex items-center gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 shadow-sm">
              <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 p-3 rounded-xl">
                <Filter className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Active Difficulty</p>
                <p className="text-base font-bold mt-1 text-foreground/90 capitalize">
                  {difficulty === 'all' ? 'All Difficulties' : `${difficulty.toLowerCase()}`}
                </p>
              </div>
            </div>

            {/* Pagination View Card */}
            <div className="bg-card/45 border border-border/40 backdrop-blur-md p-5 rounded-2xl flex items-center gap-4 hover:-translate-y-1 hover:shadow-lg transition-all duration-300 shadow-sm">
              <div className="bg-blue-500/10 text-blue-600 dark:text-blue-400 p-3 rounded-xl">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/80">Pagination View</p>
                <p className="text-base font-bold mt-1 text-foreground/90">
                  Page {currentPage} of {pagination?.totalPages ?? 1}
                </p>
              </div>
            </div>
          </div>

          {/* Elegant Filter Area */}
          <div className="bg-card/35 backdrop-blur-md border border-border/30 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-300">
            <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
                <Input
                  placeholder="Search question texts, tags..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 border-border/40 bg-background/30 backdrop-blur-sm focus-visible:ring-primary focus-visible:border-primary/50 transition-all rounded-xl text-sm"
                />
              </div>
              
              <div className="flex gap-3">
                <Select value={difficulty} onValueChange={setDifficulty}>
                  <SelectTrigger className="w-[180px] h-11 border-border/40 bg-background/30 backdrop-blur-sm rounded-xl">
                    <SelectValue placeholder="All Difficulties" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover/95 backdrop-blur-md border border-border/40 rounded-xl">
                    <SelectItem value="all">All Difficulties</SelectItem>
                    <SelectItem value="EASY">Easy</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HARD">Hard</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
                  <SelectTrigger className="w-[125px] h-11 border-border/40 bg-background/30 backdrop-blur-sm rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover/95 backdrop-blur-md border border-border/40 rounded-xl">
                    <SelectItem value="10">10 per page</SelectItem>
                    <SelectItem value="20">20 per page</SelectItem>
                    <SelectItem value="50">50 per page</SelectItem>
                    <SelectItem value="100">100 per page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Redesigned Questions Container with Weightless Antigravity feel */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-bold text-foreground/80 flex items-center gap-2 select-none">
                <HelpCircle className="h-4.5 w-4.5 text-primary" />
                <span>Question List</span>
                {isListFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              </h2>
              
              {!isListLoading && pagination && (
                <span className="text-xs text-muted-foreground font-semibold">
                  Showing {questions.length} questions
                </span>
              )}
            </div>

            <QuestionQuestionsListComponent
              questions={questions}
              isLoading={isListLoading}
              isFetching={isListFetching}
              onEdit={(q) => {
                setEditingQuestionId(q.id);
                setIsEditModalOpen(true);
              }}
              onDelete={(q) => {
                setDeletingQuestionId(q.id);
                setIsDeleteDialogOpen(true);
              }}
              emptyState={
                <div className="bg-card/25 border border-border/30 backdrop-blur-md rounded-2xl p-16 text-center shadow-inner">
                  <HelpCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30 stroke-[1.5]" />
                  <h3 className="text-lg font-bold text-foreground/80 mb-1">No Questions Found</h3>
                  <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-6">
                    No questions matched your search filters. Try typing another term or changing the difficulty.
                  </p>
                  <Link href="/admin/questions/create">
                    <Button className="bg-primary hover:bg-primary/95 text-primary-foreground gap-2 rounded-xl">
                      <Plus className="h-4 w-4" />
                      Create a Question
                    </Button>
                  </Link>
                </div>
              }
            />
          </div>

          {/* Premium Pagination Control Bar */}
          {pagination && pagination.totalPages > 1 && (
            <div className="bg-card/35 border border-border/30 backdrop-blur-md rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 shadow-sm">
              {/* Range Info */}
              <div className="text-sm font-medium text-muted-foreground select-none text-center sm:text-left">
                Showing <span className="text-foreground font-semibold">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                <span className="text-foreground font-semibold">{Math.min(currentPage * pageSize, pagination.total)}</span> of{' '}
                <span className="text-foreground font-semibold">{pagination.total}</span> questions
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center gap-1.5 flex-wrap justify-center">
                {/* First page */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1 || isListFetching}
                  className="h-9 w-9 rounded-xl border-border/40 hover:bg-secondary/40 transition-colors"
                  title="First Page"
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>

                {/* Previous */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1 || isListFetching}
                  className="h-9 w-9 rounded-xl border-border/40 hover:bg-secondary/40 transition-colors"
                  title="Previous Page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Page digits window */}
                {(() => {
                  const pages = [];
                  const totalPages = pagination.totalPages;
                  
                  let startPage = Math.max(1, currentPage - 2);
                  let endPage = Math.min(totalPages, startPage + 4);
                  
                  if (endPage - startPage < 4) {
                    startPage = Math.max(1, endPage - 4);
                  }

                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <Button
                        key={i}
                        variant={currentPage === i ? 'default' : 'outline'}
                        onClick={() => setCurrentPage(i)}
                        disabled={isListFetching}
                        className={`h-9 w-9 rounded-xl font-bold transition-all duration-200 ${
                          currentPage === i
                            ? 'bg-primary text-primary-foreground shadow-md shadow-primary/10 hover:bg-primary/95 scale-105'
                            : 'border-border/40 hover:bg-secondary/40 text-foreground/80'
                        }`}
                      >
                        {i}
                      </Button>
                    );
                  }
                  return pages;
                })()}

                {/* Next */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages))}
                  disabled={currentPage === pagination.totalPages || isListFetching}
                  className="h-9 w-9 rounded-xl border-border/40 hover:bg-secondary/40 transition-colors"
                  title="Next Page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                {/* Last page */}
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentPage(pagination.totalPages)}
                  disabled={currentPage === pagination.totalPages || isListFetching}
                  className="h-9 w-9 rounded-xl border-border/40 hover:bg-secondary/40 transition-colors"
                  title="Last Page"
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Items Per Page display */}
              <div className="flex items-center gap-2 select-none">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Per view</span>
                <Select value={String(pageSize)} onValueChange={(val) => setPageSize(Number(val))}>
                  <SelectTrigger className="w-[85px] h-9 border-border/40 bg-background/30 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover/95 border border-border/40 rounded-xl">
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </main>

        {/* View Modal Detail (kept for backup flow consistency) */}
        <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto rounded-2xl border border-border/40">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Question Details</DialogTitle>
            </DialogHeader>
            {isDetailLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              displayQuestion && (
                <div className="space-y-6 mt-2">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1 select-none">Question Text</h4>
                    <p className="text-base font-semibold leading-relaxed text-foreground/90">{displayQuestion.questionText}</p>
                  </div>
                  
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-2.5 select-none">Choices</h4>
                    <div className="space-y-2">
                      {displayQuestion.options?.map((option: any, index: number) => {
                        const letter = String.fromCharCode(65 + index);
                        return (
                          <div 
                            key={option.id || index} 
                            className={`p-3.5 rounded-xl border transition-all duration-200 flex items-center gap-3 shadow-2xs ${
                              option.isCorrect 
                                ? 'bg-emerald-500/10 border-emerald-500/40 shadow-xs' 
                                : 'bg-card/45 border-border/35 text-foreground/80'
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

                  <div className="flex gap-6 border-t border-border/20 pt-4">
                    <div>
                      <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1 select-none">Difficulty</h4>
                      <Badge variant="outline" className="capitalize font-semibold">{displayQuestion.difficulty?.toLowerCase()}</Badge>
                    </div>
                    {displayQuestion.tags && displayQuestion.tags.length > 0 && (
                      <div>
                        <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1 select-none">Tags</h4>
                        <div className="flex gap-1 flex-wrap">
                          {displayQuestion.tags.map((tag: string) => (
                            <Badge key={tag} variant="secondary" className="font-semibold">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {displayQuestion.hint && (
                    <div className="border-t border-border/20 pt-4">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1 select-none">Hint</h4>
                      <p className="text-sm bg-muted/30 p-3.5 rounded-xl border border-border/40 font-medium text-foreground/80 leading-relaxed">{displayQuestion.hint}</p>
                    </div>
                  )}
                  
                  {displayQuestion.explanation && (
                    <div className="border-t border-border/20 pt-4">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-muted-foreground mb-1 select-none">Explanation</h4>
                      <p className="text-sm bg-muted/30 p-3.5 rounded-xl border border-border/40 font-medium text-foreground/80 leading-relaxed">{displayQuestion.explanation}</p>
                    </div>
                  )}
                </div>
              )
            )}
          </DialogContent>
        </Dialog>

        {/* Edit Question Dialog (Fully functional) */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto rounded-2xl border border-border/40 shadow-xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Edit Question</DialogTitle>
            </DialogHeader>
            {isDetailLoading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="space-y-4 mt-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground/80">Question Text</label>
                  <textarea
                    className="min-h-[85px] w-full rounded-xl border border-input bg-transparent px-3.5 py-2.5 text-sm shadow-sm placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:border-primary/50 transition-all leading-relaxed"
                    placeholder="Enter question text..."
                    value={editForm.questionText}
                    onChange={(e) => setEditForm({ ...editForm, questionText: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground/80">Difficulty</label>
                    <Select
                      value={editForm.difficulty}
                      onValueChange={(val: any) => setEditForm({ ...editForm, difficulty: val })}
                    >
                      <SelectTrigger className="rounded-xl border-border/40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="EASY">Easy</SelectItem>
                        <SelectItem value="MEDIUM">Medium</SelectItem>
                        <SelectItem value="HARD">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground/80">Category / Tag</label>
                    <Input
                      placeholder="e.g. React, Math"
                      value={editForm.category}
                      onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                      className="rounded-xl h-10 border-border/40"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground/80">Hint (Optional)</label>
                    <Input
                      placeholder="Hint text"
                      value={editForm.hint}
                      onChange={(e) => setEditForm({ ...editForm, hint: e.target.value })}
                      className="rounded-xl h-10 border-border/40"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-foreground/80">Explanation (Optional)</label>
                    <Input
                      placeholder="Explanation text"
                      value={editForm.explanation}
                      onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                      className="rounded-xl h-10 border-border/40"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-foreground/80">Options</label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleEditAddOption}
                      className="h-8 gap-1 text-xs rounded-lg border-border/40"
                      disabled={editForm.options.length >= 6}
                    >
                      <Plus className="h-3 w-3" />
                      Add Option
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {editForm.options.map((option, index) => (
                      <div key={option.id} className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditCorrectToggle(option.id)}
                          className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-all ${
                            option.isCorrect
                              ? 'bg-primary border-primary text-primary-foreground'
                              : 'border-border text-muted-foreground hover:border-primary/50'
                          }`}
                        >
                          <CheckCircle2 className={`h-4 w-4 ${option.isCorrect ? 'scale-110' : 'scale-100 opacity-20'}`} />
                        </button>
                        <Input
                          placeholder={`Option ${index + 1}`}
                          value={option.text}
                          onChange={(e) => handleEditOptionChange(option.id, e.target.value)}
                          className="h-9 flex-1 rounded-xl border-border/40"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditRemoveOption(option.id)}
                          disabled={editForm.options.length <= 2}
                          className="h-9 w-9 text-muted-foreground hover:text-destructive rounded-xl hover:bg-destructive/5"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-4 border-t border-border/20">
                  <Button variant="outline" onClick={() => setIsEditModalOpen(false)} className="rounded-xl">
                    Cancel
                  </Button>
                  <Button onClick={handleUpdate} disabled={isSaving} className="gap-2 rounded-xl">
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Changes'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Alert Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent className="rounded-2xl border border-border/40">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-lg font-bold">Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                This action cannot be undone. This will permanently delete this question from the database.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2 sm:gap-0">
              <AlertDialogCancel disabled={isDeleting} className="rounded-xl">Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                disabled={isDeleting}
                className="bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-xl"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Deleting...
                  </>
                ) : (
                  'Delete Question'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
