'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowLeft, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  User, 
  Info,
  ChevronRight,
  ShieldCheck,
  Target,
  Timer,
  FileText
} from 'lucide-react';
import { submissionsApi } from '@/lib/api/post-quiz.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function SubmissionDetailPage() {
  const { id: contestId, subId } = useParams() as { id: string, subId: string };
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['submission', subId],
    queryFn: () => submissionsApi.getSubmissionDetail(subId),
  });

  const invalidateMutation = useMutation({
    mutationFn: (reason: string) => submissionsApi.invalidateSubmission(subId, reason),
    onSuccess: () => {
      toast.success('Submission invalidated');
      queryClient.invalidateQueries({ queryKey: ['submission', subId] });
    },
  });

  const submission = data?.data;

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="h-10 w-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        <p className="text-muted-foreground animate-pulse">Loading submission details...</p>
      </div>
    );
  }

  if (!submission) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-4 duration-500">
      {/* Navigation & Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-4">
          <Button 
            variant="ghost" 
            className="rounded-xl -ml-2 text-muted-foreground hover:text-foreground"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Submissions
          </Button>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">Submission Analysis</h1>
              {submission.status === 'EVALUATED' ? (
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20 px-3 py-1 gap-1.5 font-bold">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Evaluated
                </Badge>
              ) : (
                <Badge variant="secondary" className="px-3 py-1 gap-1.5 font-bold">
                  <Clock className="h-3.5 w-3.5" />
                  {submission.status}
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground flex items-center gap-2">
              ID: <span className="font-mono text-xs">{subId}</span>
              <span className="h-1 w-1 rounded-full bg-border" />
              Submitted on {format(new Date(submission.submittedAt), 'MMMM dd, yyyy @ HH:mm')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="rounded-xl border-destructive/50 text-destructive hover:bg-destructive/10"
            onClick={() => {
              const reason = window.prompt('Reason for invalidation:');
              if (reason) invalidateMutation.mutate(reason);
            }}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Invalidate
          </Button>
          <Button className="rounded-xl shadow-lg">
            Re-evaluate
          </Button>
        </div>
      </div>

      {/* Performance Summary Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-primary/5 border-primary/20 rounded-2xl overflow-hidden relative group">
          <CardContent className="p-8 space-y-4">
            <div className="h-12 w-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary mb-2">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-primary/70 uppercase tracking-widest">Final Score</p>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-black text-primary">{submission.score}</p>
                <p className="text-lg font-bold text-primary/50">/ {submission.totalQuestions * 4}</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-primary/70">Accuracy</span>
                <span className="text-primary">{submission.percentage}%</span>
              </div>
              <Progress value={parseFloat(submission.percentage)} className="h-2 bg-primary/20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden">
          <CardContent className="p-8 h-full flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="h-12 w-12 rounded-2xl bg-secondary/50 flex items-center justify-center text-muted-foreground">
                <Timer className="h-6 w-6" />
              </div>
              <Badge variant="outline" className="border-border/50">Efficiency</Badge>
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Time Taken</p>
              <p className="text-4xl font-extrabold">{formatTime(submission.timeTakenSecs)}</p>
              <p className="text-xs text-muted-foreground mt-1">Avg: 2m 14s per question</p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-secondary/20 border-border/50 rounded-2xl overflow-hidden">
          <CardContent className="p-8 h-full flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="h-12 w-12 rounded-2xl bg-secondary/50 flex items-center justify-center text-muted-foreground">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <Badge variant="outline" className="border-border/50">Breakdown</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="text-center p-2 rounded-xl bg-green-500/10 border border-green-500/20">
                <p className="text-lg font-black text-green-500">{submission.correct}</p>
                <p className="text-[10px] font-bold text-green-600 uppercase">Correct</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-destructive/10 border border-destructive/20">
                <p className="text-lg font-black text-destructive">{submission.wrong}</p>
                <p className="text-[10px] font-bold text-destructive/70 uppercase">Wrong</p>
              </div>
              <div className="text-center p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-lg font-black text-amber-500">{submission.skipped}</p>
                <p className="text-[10px] font-bold text-amber-600 uppercase">Skipped</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Answer Breakdown */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center">
            <FileText className="h-4 w-4 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Answer Breakdown</h2>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {submission.answers.map((answer: any, index: number) => (
            <Card key={answer.questionId} className={cn(
              "border-border/50 rounded-2xl overflow-hidden group transition-all hover:border-primary/30 shadow-none",
              answer.isCorrect ? "bg-green-500/[0.02]" : "bg-destructive/[0.02]"
            )}>
              <CardHeader className="p-6 pb-2">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-8 w-8 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0 font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="space-y-1">
                      <p className="font-semibold leading-relaxed text-sm md:text-base">
                        {answer.question.questionText}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-1.5 h-5 border-border/50">
                          {answer.question.difficulty}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          Answered at {format(new Date(answer.answeredAt), 'HH:mm:ss')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {answer.isCorrect ? (
                      <Badge className="bg-green-500 text-white border-none px-2 h-6 font-black tracking-tighter">
                        +{answer.marksAwarded}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="px-2 h-6 font-black tracking-tighter">
                        0.00
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6 pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {answer.question.options.map((option: any) => (
                  <div 
                    key={option.id}
                    className={cn(
                      "p-3 rounded-xl border text-sm font-medium flex items-center justify-between transition-all",
                      option.id === answer.selectedOptionId && option.isCorrect && "bg-green-500/10 border-green-500 text-green-700",
                      option.id === answer.selectedOptionId && !option.isCorrect && "bg-destructive/10 border-destructive text-destructive",
                      option.id !== answer.selectedOptionId && option.isCorrect && "bg-secondary/50 border-green-500/50 text-green-600 border-dashed",
                      option.id !== answer.selectedOptionId && !option.isCorrect && "bg-secondary/20 border-border/50 text-muted-foreground/60"
                    )}
                  >
                    <span className="truncate">{option.text}</span>
                    {option.id === answer.selectedOptionId && (
                      answer.isCorrect ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />
                    )}
                  </div>
                ))}
              </CardContent>
              {answer.question.explanation && (
                <div className="px-6 py-4 bg-secondary/10 border-t border-border/30 flex items-start gap-3">
                  <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-primary uppercase tracking-widest">Explanation</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {answer.question.explanation}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
