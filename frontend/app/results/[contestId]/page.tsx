"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { toast } from "sonner";
import { useResults } from "@/lib/hooks/useResults";
import type { Contest, QuizResult, LeaderboardEntry } from "@/lib/types";

export default function ResultsPage() {
  const params = useParams();
  const contestId = params.contestId as string;
  const [participantId, setParticipantId] = useState<string>("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  const { results, loading, error, getLeaderboard } = useResults(contestId);

  const leaderboard = getLeaderboard();
  const result = results.find(r => r.participantId === participantId);

  const handleOTPVerify = async () => {
    if (!participantId.trim()) {
      toast.error("Please enter your participant ID");
      return;
    }

    setVerifyLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 800));

      if (results.find(r => r.participantId === participantId)) {
        setOtpVerified(true);
        toast.success("Results loaded successfully");
      } else {
        toast.error("Participant ID not found. Please verify and try again.");
      }
    } catch (err) {
      toast.error("Failed to verify. Please try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  // Show OTP verification screen if not verified
  if (!otpVerified) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>View Your Results</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your participant ID to access your results
            </p>
            <div className="space-y-2">
              <label className="text-sm font-medium">Participant ID</label>
              <input
                type="text"
                placeholder="e.g., QZCP12345ABC"
                value={participantId}
                onChange={(e) => setParticipantId(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleOTPVerify()}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <Button
              onClick={handleOTPVerify}
              className="w-full"
              disabled={verifyLoading}
            >
              {verifyLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              View Results
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Results not found</h1>
        <Link href="/contests">
          <Button variant="outline">Browse Contests</Button>
        </Link>
      </div>
    );
  }

  const scorePercentage = (result.score / result.totalMarks) * 100;
  const totalAnswered = result.correctAnswers + result.wrongAnswers;
  const accuracyPercentage =
    totalAnswered > 0
      ? (result.correctAnswers / totalAnswered) * 100
      : 0;

  const getRankBadge = (rank: number) => {
    if (rank === 1) return { icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-500/10" };
    if (rank === 2) return { icon: Medal, color: "text-gray-400", bg: "bg-gray-400/10" };
    if (rank === 3) return { icon: Medal, color: "text-amber-600", bg: "bg-amber-600/10" };
    return { icon: TrendingUp, color: "text-primary", bg: "bg-primary/10" };
  };

  const rankInfo = getRankBadge(result.rank);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />

      <main className="flex-1 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          {/* Back Link */}
          <Link
            href="/contests"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to contests
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">Quiz Results</h1>
            <p className="text-muted-foreground">Your performance summary</p>
          </div>

          {/* Score Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="mb-8 overflow-hidden">
              <div className="bg-primary p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                  {/* Rank Badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className={`w-24 h-24 rounded-full ${rankInfo.bg} flex flex-col items-center justify-center`}
                  >
                    <rankInfo.icon className={`h-8 w-8 ${rankInfo.color}`} />
                    <span className="text-xl font-bold text-primary-foreground mt-1">
                      #{result.rank}
                    </span>
                  </motion.div>

                  {/* Score Display */}
                  <div className="text-center sm:text-left flex-1">
                    <p className="text-primary-foreground/80 text-sm mb-1">Your Score</p>
                    <div className="flex items-baseline gap-2 justify-center sm:justify-start">
                      <span className="text-5xl font-bold text-primary-foreground">
                        {result.score}
                      </span>
                      <span className="text-xl text-primary-foreground/80">
                        / {result.totalMarks}
                      </span>
                    </div>
                    <p className="text-primary-foreground/80 mt-2">
                      {scorePercentage >= 80
                        ? "Excellent performance!"
                        : scorePercentage >= 60
                        ? "Good job!"
                        : scorePercentage >= 40
                        ? "Keep practicing!"
                        : "Don't give up!"}
                    </p>
                  </div>

                  {/* Quick Stats */}
                  <div className="grid grid-cols-3 gap-4 sm:gap-6">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary-foreground">
                        {result.correctAnswers}
                      </div>
                      <div className="text-xs text-primary-foreground/80">Correct</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary-foreground">
                        {result.wrongAnswers}
                      </div>
                      <div className="text-xs text-primary-foreground/80">Wrong</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary-foreground">
                        {result.unattempted}
                      </div>
                      <div className="text-xs text-primary-foreground/80">Skipped</div>
                    </div>
                  </div>
                </div>
              </div>

              <CardContent className="p-6">
                <div className="grid sm:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                      <CheckCircle className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Accuracy</p>
                      <p className="font-semibold text-foreground">
                        {accuracyPercentage.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Target className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Percentile</p>
                      <p className="font-semibold text-foreground">{result.percentile}%</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Time Taken</p>
                      <p className="font-semibold text-foreground">{result.timeTaken} min</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Rank</p>
                      <p className="font-semibold text-foreground">
                        {result.rank} of {result.totalParticipants}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Tabs for Breakdown and Leaderboard */}
          <Tabs defaultValue="breakdown" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 max-w-md">
              <TabsTrigger value="breakdown">Score Breakdown</TabsTrigger>
              <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
            </TabsList>

            {/* Score Breakdown Tab */}
            <TabsContent value="breakdown">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle>Detailed Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Performance Summary */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-foreground">Performance Summary</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-foreground">Overall Accuracy</span>
                          <span className="text-muted-foreground">
                            {result.correctAnswers}/{totalAnswered} correct
                          </span>
                        </div>
                        <Progress
                          value={accuracyPercentage}
                          className="h-2"
                        />
                      </div>
                    </div>

                    {/* Answer Distribution */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-foreground">Answer Distribution</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-lg bg-success/10 text-center">
                          <CheckCircle className="h-6 w-6 text-success mx-auto mb-2" />
                          <p className="text-2xl font-bold text-foreground">
                            {result.correctAnswers}
                          </p>
                          <p className="text-sm text-muted-foreground">Correct</p>
                        </div>
                        <div className="p-4 rounded-lg bg-destructive/10 text-center">
                          <XCircle className="h-6 w-6 text-destructive mx-auto mb-2" />
                          <p className="text-2xl font-bold text-foreground">
                            {result.wrongAnswers}
                          </p>
                          <p className="text-sm text-muted-foreground">Wrong</p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted text-center">
                          <MinusCircle className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                          <p className="text-2xl font-bold text-foreground">
                            {result.unattempted}
                          </p>
                          <p className="text-sm text-muted-foreground">Skipped</p>
                        </div>
                      </div>
                    </div>

                    {/* Marks Calculation */}
                    <div className="space-y-3 p-4 rounded-lg border">
                      <h3 className="font-medium text-foreground">Marks Calculation</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Correct Answers ({result.correctAnswers} × 1)
                          </span>
                          <span className="text-success font-medium">
                            +{result.correctAnswers}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            Wrong Answers ({result.wrongAnswers} × 0)
                          </span>
                          <span className="text-destructive font-medium">
                            -{result.wrongAnswers * 0.25}
                          </span>
                        </div>
                        <div className="flex justify-between pt-2 border-t font-semibold">
                          <span className="text-foreground">Total Score</span>
                          <span className="text-primary">{result.score}/{result.totalMarks}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Leaderboard Tab */}
            <TabsContent value="leaderboard">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-primary" />
                      Leaderboard
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {leaderboard.slice(0, 20).map((entry, index) => {
                        const isCurrentUser = entry.participantId === participantId;
                        const entryRankInfo = getRankBadge(entry.rank);

                        return (
                          <motion.div
                            key={entry.participantId}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`
                              flex items-center gap-4 p-3 rounded-lg
                              ${isCurrentUser ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"}
                            `}
                          >
                            <div
                              className={`
                                w-10 h-10 rounded-full flex items-center justify-center font-bold
                                ${entry.rank <= 3 ? entryRankInfo.bg : "bg-muted"}
                                ${entry.rank <= 3 ? entryRankInfo.color : "text-muted-foreground"}
                              `}
                            >
                              {entry.rank <= 3 ? (
                                <entryRankInfo.icon className="h-5 w-5" />
                              ) : (
                                entry.rank
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-foreground flex items-center gap-2">
                                {entry.participantName}
                                {isCurrentUser && (
                                  <Badge variant="secondary" className="text-xs">
                                    You
                                  </Badge>
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {entry.timeTaken} min
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-foreground">{entry.score}</p>
                              <p className="text-xs text-muted-foreground">points</p>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </Tabs>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Button variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download Certificate
            </Button>
            <Button variant="outline" className="flex-1">
              <Share2 className="h-4 w-4 mr-2" />
              Share Results
            </Button>
            <Link href="/contests" className="flex-1">
              <Button className="w-full">Browse More Contests</Button>
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
