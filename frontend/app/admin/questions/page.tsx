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
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Eye,
  HelpCircle,
  Search,
  Loader2,
} from 'lucide-react';
import { useQuestions, useQuestion } from '@/lib/hooks/useQuestions';

export default function QuestionsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);

  const { questions = [], isLoading: isListLoading, isFetching: isListFetching } = useQuestions({
    search: searchTerm,
    difficulty: difficulty === 'all' ? undefined : difficulty,
  });

  const { question: detailedQuestion, isLoading: isDetailLoading } = useQuestion(isViewModalOpen ? selectedQuestionId : null);

  const displayQuestion = detailedQuestion || questions.find((q: any) => q.id === selectedQuestionId);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur">
        <div className="mx-auto max-max-7xl px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <Link href="/admin" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
            <span>Back</span>
          </Link>
          <h1 className="text-2xl font-bold">Question Bank</h1>
          <Link href="/admin/questions/create">
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              New Question
            </Button>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Filters */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Difficulties</SelectItem>
                <SelectItem value="EASY">Easy</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="HARD">Hard</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Questions List */}
        <Card className="border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5" />
                  Questions
                  {isListFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                </CardTitle>
                <CardDescription>
                  Total: {questions.length} questions
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {isListLoading && questions.length === 0 ? (
              <div className="text-center py-12">
                <Loader2 className="h-12 w-12 mx-auto mb-4 animate-spin text-primary" />
                <p className="text-muted-foreground">Loading questions...</p>
              </div>
            ) : questions.length === 0 ? (
              <div className="text-center py-12">
                <HelpCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">No questions found</p>
                <Link href="/admin/questions/create">
                  <Button>Create Your First Question</Button>
                </Link>
              </div>
            ) : (
              <div className={`space-y-3 transition-opacity ${isListFetching ? 'opacity-60' : 'opacity-100'}`}>
                {questions.map((question: any) => (
                  <div
                    key={question.id}
                    className="flex items-start justify-between p-4 rounded-lg border border-border/50 hover:bg-secondary/20 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge
                          variant={
                            question.difficulty === 'EASY'
                              ? 'secondary'
                              : question.difficulty === 'MEDIUM'
                              ? 'default'
                              : 'destructive'
                          }
                        >
                          {question.difficulty?.charAt(0) + question.difficulty?.slice(1).toLowerCase()}
                        </Badge>
                      </div>
                      <h3 className="font-semibold mb-1">{question.questionText}</h3>
                      <p className="text-sm text-muted-foreground">
                        {question.tags?.length > 0 ? question.tags.join(', ') : 'Untagged'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => {
                          setSelectedQuestionId(question.id);
                          setIsViewModalOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Link href={`/admin/questions/${question.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question Details</DialogTitle>
          </DialogHeader>
          {isDetailLoading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : displayQuestion && (
            <div className="space-y-6 mt-2">
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-1">Question</h4>
                <p className="text-base font-medium">{displayQuestion.questionText}</p>
              </div>
              
              <div>
                <h4 className="font-semibold text-sm text-muted-foreground mb-2">Options</h4>
                <div className="space-y-2">
                  {displayQuestion.options?.map((option: any, index: number) => (
                    <div 
                      key={option.id || index} 
                      className={`p-3 rounded-md border ${option.isCorrect ? 'bg-green-500/10 border-green-500/30' : 'bg-secondary/20 border-border/50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-muted-foreground">{String.fromCharCode(65 + index)}.</span>
                        <span>{option.text}</span>
                        {option.isCorrect && (
                          <Badge variant="outline" className="ml-auto bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">
                            Correct
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-6">
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">Difficulty</h4>
                  <Badge variant="outline" className="capitalize">{displayQuestion.difficulty?.toLowerCase()}</Badge>
                </div>
                {displayQuestion.tags && displayQuestion.tags.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-sm text-muted-foreground mb-1">Tags</h4>
                    <div className="flex gap-1 flex-wrap">
                      {displayQuestion.tags.map((tag: string) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {displayQuestion.hint && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">Hint</h4>
                  <p className="text-sm bg-muted/30 p-3 rounded-md border border-border/50">{displayQuestion.hint}</p>
                </div>
              )}
              
              {displayQuestion.explanation && (
                <div>
                  <h4 className="font-semibold text-sm text-muted-foreground mb-1">Explanation</h4>
                  <p className="text-sm bg-muted/30 p-3 rounded-md border border-border/50">{displayQuestion.explanation}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
