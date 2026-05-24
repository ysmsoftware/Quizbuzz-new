'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Medal,
  Target,
  Clock,
  CheckCircle,
  XCircle,
  MinusCircle,
  TrendingUp,
  ArrowLeft,
  Download,
  Share2,
  Loader2,
  Search,
  Calendar,
  Sparkles,
  FileText,
  AlertCircle
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { PublicHeader } from '@/components/layout/public-header';
import { Footer } from '@/components/layout/footer';
import { toast } from 'sonner';
import { useResults } from '@/lib/hooks/useResults';
import { useParticipantSubmission } from '@/lib/hooks/useParticipantSubmission';
import { contestService } from '@/lib/services/contest-service';
import { cn } from '@/lib/utils';
import type { QuizResult } from '@/lib/types';

export default function QuizResultsPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();

  // Search/Input state
  const [identifierInput, setIdentifierInput] = useState('');
  const [verifiedId, setVerifiedId] = useState('');
  const [isLookupVerified, setIsLookupVerified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [leaderboardSearch, setLeaderboardSearch] = useState('');

  // 1. Fetch contest details by slug
  const { data: contestRes, isLoading: isContestLoading } = useQuery({
    queryKey: ['contest-by-slug', slug],
    queryFn: () => contestService.getContestBySlug(slug),
  });

  const contest = contestRes?.success ? contestRes.data : null;
  const contestId = contest?.id;

  // Hooks for results and submissions
  const { results, loading: isResultsLoading, getLeaderboard } = useResults(contestId || '', verifiedId);
  const { fetchParticipantSubmission } = useParticipantSubmission();

  const leaderboard = getLeaderboard() || [];
  const participantResult = results.find(r => r.participantId === verifiedId);

  // Check if participant was absent
  const isAbsent = participantResult && (participantResult as any).breakdown?.length === 0 && participantResult.correctAnswers === 0 && participantResult.wrongAnswers === 0;

  const handleLookupVerify = async () => {
    if (!identifierInput.trim()) {
      toast.error('Please enter your Email, Phone, or Registration Reference.');
      return;
    }

    setVerifyLoading(true);
    try {
      const res = await fetchParticipantSubmission(identifierInput.trim(), { contestSlug: slug });
      if (res.success && res.data) {
        const sub = res.data;
        setVerifiedId(sub.participantId);
        setIsLookupVerified(true);
        toast.success('Your results have been loaded successfully.');
      } else {
        toast.error('Participant details not found. Please double-check and try again.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to locate participant details. Please verify your info.');
    } finally {
      setVerifyLoading(false);
    }
  };

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: Trophy, color: 'text-yellow-500', bg: 'bg-yellow-500/10 border-yellow-500/20' };
    if (rank === 2) return { icon: Medal, color: 'text-slate-400', bg: 'bg-slate-400/10 border-slate-400/20' };
    if (rank === 3) return { icon: Medal, color: 'text-amber-600', bg: 'bg-amber-600/10 border-amber-600/20' };
    return { icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10 border-primary/20' };
  };

  if (isContestLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <PublicHeader />
        <div className="flex-1 flex flex-col items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground text-sm font-medium">Loading contest details...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="min-h-screen bg-background flex flex-col justify-between">
        <PublicHeader />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
            <AlertCircle className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="text-2xl font-black mb-2">Contest Not Found</h1>
          <p className="text-muted-foreground max-w-md">
            The requested contest does not exist or has been deleted.
          </p>
          <Link href="/contests" className="mt-6">
            <Button className="rounded-xl h-11 px-6">
              Browse Contests
            </Button>
          </Link>
        </div>
        <Footer />
      </div>
    );
  }

  // Filter leaderboard search
  const filteredLeaderboard = leaderboard.filter(entry =>
    entry.participantName.toLowerCase().includes(leaderboardSearch.toLowerCase()) ||
    entry.participantId.toLowerCase().includes(leaderboardSearch.toLowerCase())
  );

  const topThree = leaderboard.slice(0, 3);
  const remainingRankings = filteredLeaderboard.filter(e => e.rank > 3);

  return (
    <div className="min-h-screen bg-background flex flex-col relative overflow-hidden">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-0 left-0 w-full h-[500px] opacity-10 pointer-events-none z-0">
        <div className="absolute top-12 left-1/4 h-80 w-80 rounded-full bg-primary blur-[150px] animate-pulse" />
        <div className="absolute top-36 right-1/4 h-96 w-96 rounded-full bg-accent blur-[180px]" />
      </div>

      <PublicHeader />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 relative z-10 max-w-6xl mx-auto w-full">
        <Link
          href={`/quiz/${slug}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Quiz Info
        </Link>

        <AnimatePresence mode="wait">
          {!isLookupVerified ? (
            <motion.div
              key="lookup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4 }}
              className="max-w-md mx-auto"
            >
              <Card className="border-border/40 bg-background/60 backdrop-blur-xl shadow-2xl rounded-[2rem] overflow-hidden">
                <div className="bg-primary/5 p-8 border-b border-border/40 text-center relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full bg-primary/10 blur-xl" />
                  <Trophy className="h-12 w-12 text-primary mx-auto mb-4" />
                  <CardTitle className="text-2xl font-black tracking-tight mb-2">View Your Results</CardTitle>
                  <CardDescription className="text-sm font-medium text-muted-foreground">
                    Enter your registration details below to access your dynamic scorecard and leaderboard standing.
                  </CardDescription>
                </div>

                <CardContent className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                      Email, Phone, or Registration ID
                    </label>
                    <Input
                      type="text"
                      placeholder="e.g., user@example.com, QB-MPHXZ6OR-ENH"
                      value={identifierInput}
                      onChange={(e) => setIdentifierInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLookupVerify()}
                      className="h-12 rounded-xl border-border/50 bg-secondary/30 focus:bg-background transition-all"
                    />
                  </div>

                  <Button
                    onClick={handleLookupVerify}
                    className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all text-sm uppercase tracking-wider"
                    disabled={verifyLoading}
                  >
                    {verifyLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Fetching Record...
                      </>
                    ) : (
                      'View My Scorecard'
                    )}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5 }}
              className="space-y-10"
            >
              {/* Profile Bar */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-secondary/20 border border-border/40 rounded-3xl p-6 backdrop-blur-md">
                <div>
                  <Badge className="bg-primary/10 text-primary border-none px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2">
                    Contest Completed
                  </Badge>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
                    {contest.title}
                  </h1>
                </div>

                {participantResult && (
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-sm font-black text-primary border border-primary/20">
                      {participantResult.participantName[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-extrabold text-foreground leading-none mb-1">
                        {participantResult.participantName}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {identifierInput.includes('@') ? identifierInput : 'Verified Participant'}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {isResultsLoading ? (
                <div className="h-64 flex flex-col items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary mb-3" />
                  <p className="text-muted-foreground text-sm font-medium">Analyzing submission data...</p>
                </div>
              ) : !participantResult ? (
                <Card className="border-border/40 bg-background/60 backdrop-blur-xl rounded-3xl p-8 text-center max-w-lg mx-auto">
                  <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                  <h2 className="text-xl font-bold mb-2">No submission found</h2>
                  <p className="text-muted-foreground text-sm mb-6">
                    We could not load a submission for this participant in the system.
                  </p>
                  <Button variant="outline" className="rounded-xl" onClick={() => setIsLookupVerified(false)}>
                    Try another search
                  </Button>
                </Card>
              ) : (
                <>
                  {/* Dynamic Scorecard / Performance summary */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Primary metrics column */}
                    <Card className={cn(
                      "lg:col-span-2 border-border/40 bg-background/60 backdrop-blur-xl shadow-xl rounded-[2rem] overflow-hidden flex flex-col justify-between",
                      isAbsent && "border-destructive/20 bg-destructive/5"
                    )}>
                      <div className="bg-primary/5 p-8 border-b border-border/40 flex flex-col sm:flex-row items-center justify-between gap-6 relative">
                        {/* Rank Circle */}
                        {!isAbsent ? (
                          <div className="flex items-center gap-4">
                            <div className={cn(
                              "h-20 w-20 rounded-[2rem] flex flex-col items-center justify-center border shadow-lg rotate-3 hover:rotate-0 transition-transform",
                              getRankBadge(participantResult.rank).bg
                            )}>
                              {(() => {
                                const rb = getRankBadge(participantResult.rank);
                                return <rb.icon className={cn("h-6 w-6", rb.color)} />;
                              })()}
                              <span className="text-sm font-black text-foreground mt-0.5">
                                Rank #{participantResult.rank}
                              </span>
                            </div>
                            <div>
                              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Official Standings</p>
                              <h3 className="text-xl font-extrabold text-foreground mt-1">
                                {participantResult.isPassed ? "Excellent Effort!" : "Keep Practicing!"}
                              </h3>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-4">
                            <div className="h-20 w-20 rounded-[2rem] bg-destructive/10 flex flex-col items-center justify-center border border-destructive/20">
                              <XCircle className="h-6 w-6 text-destructive" />
                              <span className="text-xs font-black text-destructive mt-0.5">ABSENT</span>
                            </div>
                            <div>
                              <p className="text-xs font-black uppercase tracking-widest text-destructive">Record Status</p>
                              <h3 className="text-xl font-extrabold text-foreground mt-1">Marked as Absent</h3>
                            </div>
                          </div>
                        )}

                        {/* Scores */}
                        <div className="text-center sm:text-right">
                          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Total Score</p>
                          <div className="flex items-baseline justify-center sm:justify-end gap-2 mt-1">
                            <span className="text-5xl font-black text-primary tracking-tight">
                              {participantResult.score}
                            </span>
                            <span className="text-lg font-bold text-muted-foreground">
                              / {participantResult.totalMarks}
                            </span>
                          </div>
                        </div>
                      </div>

                      <CardContent className="p-8 space-y-6">
                        {isAbsent ? (
                          <div className="flex gap-4 p-5 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive-foreground">
                            <AlertCircle className="h-6 w-6 text-destructive shrink-0 mt-0.5" />
                            <div>
                              <h4 className="font-extrabold text-foreground mb-1">Non-Attendance Logged</h4>
                              <p className="text-sm text-muted-foreground leading-relaxed">
                                You did not launch or participate in this live quiz. To ensure complete audit logs, an official absent record has been compiled with zero points.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/30 hover:scale-[1.02] transition-transform">
                              <div className="flex items-center gap-2 mb-2">
                                <CheckCircle className="h-4 w-4 text-success" />
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Accuracy</span>
                              </div>
                              <p className="text-xl font-black text-foreground">
                                {(() => {
                                  const totalAttempted = participantResult.correctAnswers + participantResult.wrongAnswers;
                                  return totalAttempted > 0 ? ((participantResult.correctAnswers / totalAttempted) * 100).toFixed(1) : '0';
                                })()}%
                              </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/30 hover:scale-[1.02] transition-transform">
                              <div className="flex items-center gap-2 mb-2">
                                <Target className="h-4 w-4 text-primary" />
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Percentile</span>
                              </div>
                              <p className="text-xl font-black text-foreground">
                                {participantResult.percentile.toFixed(1)}%
                              </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/30 hover:scale-[1.02] transition-transform">
                              <div className="flex items-center gap-2 mb-2">
                                <Clock className="h-4 w-4 text-warning" />
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Time Taken</span>
                              </div>
                              <p className="text-xl font-black text-foreground">
                                {participantResult.timeTaken}
                              </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-secondary/30 border border-border/30 hover:scale-[1.02] transition-transform">
                              <div className="flex items-center gap-2 mb-2">
                                <TrendingUp className="h-4 w-4 text-accent-foreground" />
                                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rank Status</span>
                              </div>
                              <p className="text-xl font-black text-foreground">
                                #{participantResult.rank} / {participantResult.totalParticipants}
                              </p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Breakdown circular column */}
                    <Card className="border-border/40 bg-background/60 backdrop-blur-xl shadow-xl rounded-[2rem] p-8 flex flex-col justify-between">
                      <div>
                        <h3 className="text-lg font-black tracking-tight mb-2">Question breakdown</h3>
                        <p className="text-sm font-medium text-muted-foreground mb-6">A breakdown of all your attempted questions.</p>

                        <div className="space-y-4">
                          {/* Correct Answers */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                              <span className="text-success flex items-center gap-1.5">
                                <CheckCircle className="h-3.5 w-3.5" /> Correct
                              </span>
                              <span className="text-foreground">{participantResult.correctAnswers}</span>
                            </div>
                            <Progress value={(participantResult.correctAnswers / participantResult.totalMarks) * 100} className="h-2 bg-secondary" />
                          </div>

                          {/* Wrong Answers */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                              <span className="text-destructive flex items-center gap-1.5">
                                <XCircle className="h-3.5 w-3.5" /> Wrong
                              </span>
                              <span className="text-foreground">{participantResult.wrongAnswers}</span>
                            </div>
                            <Progress value={(participantResult.wrongAnswers / participantResult.totalMarks) * 100} className="h-2 bg-secondary animate-pulse" />
                          </div>

                          {/* Unattempted / Skipped */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                              <span className="text-muted-foreground flex items-center gap-1.5">
                                <MinusCircle className="h-3.5 w-3.5" /> Skipped
                              </span>
                              <span className="text-foreground">{participantResult.unattempted}</span>
                            </div>
                            <Progress value={(participantResult.unattempted / participantResult.totalMarks) * 100} className="h-2 bg-secondary" />
                          </div>
                        </div>
                      </div>

                      {!isAbsent && (
                        <div className="mt-8 flex flex-col sm:flex-row gap-3">
                          <Button variant="outline" className="flex-1 rounded-xl h-11 border-border/50 text-xs font-bold uppercase tracking-widest">
                            <Download className="h-3.5 w-3.5 mr-2" /> Cert
                          </Button>
                          <Button variant="outline" className="flex-1 rounded-xl h-11 border-border/50 text-xs font-bold uppercase tracking-widest">
                            <Share2 className="h-3.5 w-3.5 mr-2" /> Share
                          </Button>
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* Main Tab Controls */}
                  <Tabs defaultValue={isAbsent ? 'leaderboard' : 'breakdown'} className="space-y-8">
                    <div className="border-b border-border/40 pb-4">
                      <TabsList className="bg-secondary/40 border border-border/40 p-1 rounded-2xl gap-2">
                        {!isAbsent && (
                          <TabsTrigger value="breakdown" className="rounded-xl text-xs font-black uppercase tracking-wider px-5 py-2">
                            Detailed breakdown
                          </TabsTrigger>
                        )}
                        <TabsTrigger value="leaderboard" className="rounded-xl text-xs font-black uppercase tracking-wider px-5 py-2">
                          Live Leaderboard
                        </TabsTrigger>
                      </TabsList>
                    </div>

                    {!isAbsent && (
                      <TabsContent value="breakdown" className="space-y-6">
                        <h3 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary" /> Question-by-Question Analysis
                        </h3>

                        <div className="grid gap-4">
                          {participantResult.breakdown?.map((item: any) => {
                            const isCorrect = item.isCorrect;
                            const isSkipped = item.yourAnswer.length === 0;
                            const isWrong = !isCorrect && !isSkipped;

                            return (
                              <div
                                key={item.questionId}
                                className={cn(
                                  "p-6 rounded-[1.5rem] border transition-all duration-300 relative overflow-hidden group",
                                  isCorrect && "bg-success/5 border-success/20 hover:bg-success/8",
                                  isWrong && "bg-destructive/5 border-destructive/20 hover:bg-destructive/8",
                                  isSkipped && "bg-secondary/20 border-border/30 hover:bg-secondary/30"
                                )}
                              >
                                <div className="flex justify-between items-center gap-4 mb-4">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                                    Question {item.questionNumber}
                                  </span>
                                  <Badge
                                    className={cn(
                                      "rounded-full px-3 py-1 font-bold text-xs uppercase tracking-wider border-none",
                                      isCorrect && "bg-success/20 text-success",
                                      isWrong && "bg-destructive/20 text-destructive",
                                      isSkipped && "bg-secondary text-muted-foreground"
                                    )}
                                  >
                                    {isCorrect && `Correct (+1)`}
                                    {isWrong && `Incorrect (-0.25)`}
                                    {isSkipped && "Skipped (0)"}
                                  </Badge>
                                </div>

                                <p className="font-extrabold text-foreground text-base mb-6 leading-snug">
                                  {item.questionText}
                                </p>

                                <div className="grid md:grid-cols-2 gap-4 text-sm">
                                  <div className="p-4 rounded-2xl bg-background/50 border border-border/50">
                                    <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1.5">Your Choice</p>
                                    <p className={cn(
                                      "font-extrabold",
                                      isCorrect && "text-success",
                                      isWrong && "text-destructive",
                                      isSkipped && "text-muted-foreground italic"
                                    )}>
                                      {isSkipped ? 'No Answer Submitted' : item.yourAnswer.join(', ')}
                                    </p>
                                  </div>

                                  {!isCorrect && (
                                    <div className="p-4 rounded-2xl bg-background/50 border border-border/50">
                                      <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1.5">Official Solution</p>
                                      <p className="font-extrabold text-success">
                                        {item.correctAnswer.join(', ')}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </TabsContent>
                    )}

                    <TabsContent value="leaderboard" className="space-y-6 animate-in fade-in-50 duration-300">
                      {/* Top Podium for Leaderboard */}
                      {topThree.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end pb-8">
                          {/* Rank 2 */}
                          {topThree[1] && (
                            <Card className="order-2 md:order-1 bg-background/50 backdrop-blur-xl border-border/40 rounded-[2.2rem] shadow-xl overflow-hidden hover:scale-[1.02] transition-all group relative">
                              <CardContent className="p-8 pt-12 text-center relative">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-14 w-14 rounded-2xl bg-slate-200 flex items-center justify-center rotate-6 group-hover:rotate-0 transition-transform shadow-md border-4 border-background">
                                  <Medal className="h-6 w-6 text-slate-600" />
                                </div>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">Silver Medalist</p>
                                <h3 className="text-xl font-black mb-1 text-foreground leading-none">{topThree[1].participantName}</h3>
                                <p className="text-xs text-muted-foreground font-mono mb-6">{topThree[1].participantId.substring(0, 12)}</p>

                                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-secondary/40 border border-border/40 text-sm">
                                  <div>
                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Score</p>
                                    <p className="text-base font-black text-foreground">{topThree[1].score}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Time</p>
                                    <p className="text-base font-black text-foreground">{topThree[1].timeTaken}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Rank 1 */}
                          {topThree[0] && (
                            <Card className="order-1 md:order-2 bg-background/80 backdrop-blur-xl border-primary/20 rounded-[2.8rem] shadow-2xl overflow-hidden md:-mt-6 scale-105 hover:scale-[1.07] transition-all group ring-4 ring-primary/5">
                              <CardContent className="p-10 pt-16 text-center relative">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-18 w-18 rounded-3xl bg-primary flex items-center justify-center -rotate-6 group-hover:rotate-0 transition-transform shadow-xl border-8 border-background">
                                  <Trophy className="h-8 w-8 text-primary-foreground" />
                                </div>
                                <p className="text-xs font-black text-primary uppercase tracking-[0.25em] mb-4 flex items-center justify-center gap-1.5">
                                  <Sparkles className="h-3 w-3 fill-primary" /> Winner <Sparkles className="h-3 w-3 fill-primary" />
                                </p>
                                <h3 className="text-2xl font-black mb-1 text-foreground leading-none">{topThree[0].participantName}</h3>
                                <p className="text-xs text-muted-foreground font-mono mb-6">{topThree[0].participantId.substring(0, 12)}</p>

                                <div className="grid grid-cols-2 gap-4 p-5 rounded-[1.8rem] bg-primary/5 border border-primary/10 text-sm">
                                  <div>
                                    <p className="text-[9px] text-primary/70 uppercase font-bold tracking-wider mb-0.5">Total Score</p>
                                    <p className="text-lg font-black text-primary">{topThree[0].score}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-primary/70 uppercase font-bold tracking-wider mb-0.5">Time</p>
                                    <p className="text-lg font-black text-primary">{topThree[0].timeTaken}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Rank 3 */}
                          {topThree[2] && (
                            <Card className="order-3 bg-background/50 backdrop-blur-xl border-border/40 rounded-[2.2rem] shadow-xl overflow-hidden hover:scale-[1.02] transition-all group relative">
                              <CardContent className="p-8 pt-12 text-center relative">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-14 w-14 rounded-2xl bg-amber-100 flex items-center justify-center -rotate-6 group-hover:rotate-0 transition-transform shadow-md border-4 border-background">
                                  <Medal className="h-6 w-6 text-amber-700" />
                                </div>
                                <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-3">Bronze Medalist</p>
                                <h3 className="text-xl font-black mb-1 text-foreground leading-none">{topThree[2].participantName}</h3>
                                <p className="text-xs text-muted-foreground font-mono mb-6">{topThree[2].participantId.substring(0, 12)}</p>

                                <div className="grid grid-cols-2 gap-3 p-4 rounded-2xl bg-amber-50/20 border border-amber-200/30 text-sm">
                                  <div>
                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Score</p>
                                    <p className="text-base font-black text-foreground">{topThree[2].score}</p>
                                  </div>
                                  <div>
                                    <p className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-0.5">Time</p>
                                    <p className="text-base font-black text-foreground">{topThree[2].timeTaken}</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )}
                        </div>
                      )}

                      {/* Main rankings list */}
                      <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                          <h4 className="text-lg font-black tracking-tight flex items-center gap-2">
                            <FileText className="h-5 w-5 text-muted-foreground" /> All Official Standings
                          </h4>
                          <div className="relative w-full sm:w-72">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search ranking board..."
                              value={leaderboardSearch}
                              onChange={(e) => setLeaderboardSearch(e.target.value)}
                              className="pl-10 h-10 rounded-xl bg-secondary/30 border-border/50 focus:bg-background transition-all text-xs"
                            />
                          </div>
                        </div>

                        <Card className="bg-background/50 border-border/40 rounded-[2rem] overflow-hidden shadow-sm">
                          <Table>
                            <TableHeader className="bg-secondary/30">
                              <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-bold h-12 pl-8 text-xs">Rank</TableHead>
                                <TableHead className="font-bold text-xs">Participant</TableHead>
                                <TableHead className="font-bold text-center text-xs">Score</TableHead>
                                <TableHead className="font-bold text-center text-xs">Timing</TableHead>
                                <TableHead className="font-bold text-right pr-8 text-xs">Badge</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {remainingRankings.length === 0 ? (
                                <TableRow>
                                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic text-xs">
                                    No records found matching search queries.
                                  </TableCell>
                                </TableRow>
                              ) : (
                                remainingRankings.map((entry) => {
                                  const isSelf = entry.participantId === verifiedId;
                                  return (
                                    <TableRow
                                      key={entry.participantId}
                                      className={cn(
                                        "hover:bg-secondary/10 transition-colors border-border/20 group",
                                        isSelf && "bg-primary/5 hover:bg-primary/8 border-l-4 border-l-primary"
                                      )}
                                    >
                                      <TableCell className="pl-8">
                                        <span className={cn(
                                          "h-7 w-7 rounded-lg bg-secondary flex items-center justify-center text-[10px] font-black",
                                          isSelf && "bg-primary text-primary-foreground"
                                        )}>
                                          {entry.rank}
                                        </span>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-3">
                                          <div className={cn(
                                            "h-8 w-8 rounded-full bg-primary/5 flex items-center justify-center text-[9px] font-black text-primary border border-primary/10",
                                            isSelf && "bg-primary/20"
                                          )}>
                                            {entry.participantName[0]?.toUpperCase() || 'P'}
                                          </div>
                                          <div>
                                            <p className="font-bold text-xs leading-none mb-1 text-foreground">
                                              {entry.participantName}
                                              {isSelf && (
                                                <Badge className="ml-2 bg-primary/10 text-primary border-none text-[9px] font-extrabold px-1.5 py-0">
                                                  YOU
                                                </Badge>
                                              )}
                                            </p>
                                            <p className="text-[9px] text-muted-foreground font-mono">
                                              {entry.participantId.substring(0, 12)}
                                            </p>
                                          </div>
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center font-black text-xs text-foreground">{entry.score}</TableCell>
                                      <TableCell className="text-center text-xs font-bold text-muted-foreground">{entry.timeTaken}</TableCell>
                                      <TableCell className="text-right pr-8">
                                        <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest bg-secondary/50 text-muted-foreground border-none">
                                          Rank {entry.rank}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })
                              )}
                            </TableBody>
                          </Table>
                        </Card>
                      </div>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Footer />
    </div>
  );
}
