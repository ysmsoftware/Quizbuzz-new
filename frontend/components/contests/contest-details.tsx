'use client';

import Link from 'next/link';
import type { Contest } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Calendar,
  Clock,
  Users,
  Trophy,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Shield,
  FileText,
  Award,
  Timer,
  IndianRupee,
} from 'lucide-react';

interface ContestDetailsProps {
  contest: Contest;
}

const difficultyColors = {
  easy: 'bg-success/10 text-success border-success/20',
  medium: 'bg-warning/10 text-warning-foreground border-warning/30',
  hard: 'bg-destructive/10 text-destructive border-destructive/20',
};

const statusColors = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-primary/10 text-primary',
  active: 'bg-success/10 text-success',
  completed: 'bg-secondary text-secondary-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
};

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(':');
  const date = new Date();
  date.setHours(parseInt(hours), parseInt(minutes));
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function ContestDetails({ contest }: ContestDetailsProps) {
  const spotsLeft = contest.maxParticipants - contest.currentParticipants;
  const spotsPercentage = (contest.currentParticipants / contest.maxParticipants) * 100;
  const isRegistrationOpen = contest.status === 'published' || contest.status === 'active';

  return (
    <div className="bg-secondary/10">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-primary/5 to-transparent border-b">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-start gap-2 mb-4">
            <Badge variant="outline" className={statusColors[contest.status]}>
              {contest.status.charAt(0).toUpperCase() + contest.status.slice(1)}
            </Badge>
            <Badge variant="outline" className={difficultyColors[contest.difficulty]}>
              {contest.difficulty.charAt(0).toUpperCase() + contest.difficulty.slice(1)}
            </Badge>
            <Badge variant="outline">{contest.category}</Badge>
          </div>

          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl text-balance">
            {contest.title}
          </h1>

          <p className="mt-4 text-lg text-muted-foreground max-w-3xl">
            {contest.description}
          </p>

          {/* Quick Stats */}
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-3 rounded-lg bg-card border p-4">
              <Calendar className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Contest Date</p>
                <p className="font-semibold">{formatDate(contest.contestDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-card border p-4">
              <Clock className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Duration</p>
                <p className="font-semibold">{contest.durationMinutes} minutes</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-card border p-4">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Questions</p>
                <p className="font-semibold">{contest.totalQuestions} questions</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg bg-card border p-4">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">Registered</p>
                <p className="font-semibold">{(contest.currentParticipants || 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Left Column - Details */}
            <div className="lg:col-span-2 space-y-8">
              {/* About */}
              <Card>
                <CardHeader>
                  <CardTitle>About This Contest</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground whitespace-pre-line">
                    {contest.description}
                  </p>
                </CardContent>
              </Card>

              {/* Contest Rules */}
              <Card>
                <CardHeader>
                  <CardTitle>Contest Rules & Format</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Total Questions</p>
                        <p className="text-sm text-muted-foreground">{contest.totalQuestions} questions</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Award className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Total Marks</p>
                        <p className="text-sm text-muted-foreground">{contest.totalMarks} marks</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Trophy className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Passing Marks</p>
                        <p className="text-sm text-muted-foreground">{contest.passingMarks} marks ({Math.round((contest.passingMarks / contest.totalMarks) * 100)}%)</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Timer className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Time Limit</p>
                        <p className="text-sm text-muted-foreground">{contest.durationMinutes} minutes</p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium">Additional Rules</h4>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-sm">
                        {contest.negativeMarking ? (
                          <>
                            <AlertCircle className="h-4 w-4 text-destructive" />
                            <span>Negative marking: -{contest.negativeMarkValue} marks per wrong answer</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-success" />
                            <span>No negative marking</span>
                          </>
                        )}
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        {contest.shuffleQuestions ? (
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                        ) : (
                          <XCircle className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span>Questions {contest.shuffleQuestions ? 'will be' : 'will not be'} shuffled</span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        {contest.allowBackNavigation ? (
                          <CheckCircle2 className="h-4 w-4 text-success" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span>Back navigation {contest.allowBackNavigation ? 'allowed' : 'not allowed'}</span>
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>

              {/* Proctoring */}
              {contest.proctoringEnabled && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      Proctoring Requirements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                      This contest has proctoring enabled to ensure fair play. Please ensure you meet the following requirements:
                    </p>
                    <ul className="space-y-2">
                      {contest.fullscreenRequired && (
                        <li className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span>Fullscreen mode required</span>
                        </li>
                      )}
                      {contest.webcamRequired && (
                        <li className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span>Webcam access required</span>
                        </li>
                      )}
                      <li className="flex items-center gap-2 text-sm">
                        <AlertCircle className="h-4 w-4 text-warning" />
                        <span>Tab switching limit: {contest.tabSwitchLimit} times (disqualification after exceeding)</span>
                      </li>
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Prizes */}
              {contest.prizes && contest.prizes.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-accent" />
                      Prizes & Recognition
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {contest.prizes.map((prize, index) => (
                        <div
                          key={index}
                          className={`flex items-center gap-4 p-4 rounded-lg border ${
                            index === 0 
                              ? 'bg-accent/10 border-accent/30' 
                              : index === 1 
                                ? 'bg-secondary border-border' 
                                : 'bg-card'
                          }`}
                        >
                          <div className={`flex h-12 w-12 items-center justify-center rounded-full font-bold ${
                            index === 0 
                              ? 'bg-accent text-accent-foreground' 
                              : index === 1 
                                ? 'bg-muted text-muted-foreground' 
                                : 'bg-muted/50 text-muted-foreground'
                          }`}>
                            {typeof prize.rank === 'number' ? `#${prize.rank}` : prize.rank}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold">{prize.title}</p>
                            {prize.description && (
                              <p className="text-sm text-muted-foreground">{prize.description}</p>
                            )}
                          </div>
                          {prize.amount && (
                            <p className="text-lg font-bold text-primary">
                              {formatCurrency(prize.amount)}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column - Registration Card */}
            <div className="lg:col-span-1">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle>Register Now</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Fee */}
                  <div className="text-center py-4 bg-secondary/50 rounded-lg">
                    <p className="text-sm text-muted-foreground">Registration Fee</p>
                    <p className="text-4xl font-bold text-primary">
                      {contest.registrationFee === 0 ? 'Free' : formatCurrency(contest.registrationFee)}
                    </p>
                  </div>

                  {/* Timing */}
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Registration Ends</span>
                      <span className="font-medium">{formatDate(contest.registrationEndDate)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Contest Time</span>
                      <span className="font-medium">
                        {formatTime(contest.contestStartTime)} - {formatTime(contest.contestEndTime)}
                      </span>
                    </div>
                  </div>

                  {/* Capacity */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Available Spots</span>
                      <span className="font-medium">{(spotsLeft || 0).toLocaleString()} / {(contest.maxParticipants || 0).toLocaleString()}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div 
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min(spotsPercentage, 100)}%` }}
                      />
                    </div>
                    {spotsPercentage >= 80 && (
                      <p className="flex items-center gap-1 text-xs text-destructive">
                        <AlertCircle className="h-3 w-3" />
                        Filling up fast!
                      </p>
                    )}
                  </div>

                  {/* CTA */}
                  {isRegistrationOpen ? (
                    <Link href={`/contests/${contest.slug}/register`} className="block">
                      <Button size="lg" className="w-full gap-2">
                        Register Now
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  ) : (
                    <Button size="lg" className="w-full" disabled>
                      {contest.status === 'completed' ? 'Contest Ended' : 'Registration Closed'}
                    </Button>
                  )}

                  <p className="text-xs text-center text-muted-foreground">
                    By registering, you agree to our Terms of Service and Contest Rules
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
