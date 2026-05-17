'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { 
  Trophy, 
  Medal, 
  ChevronLeft, 
  Search, 
  Crown,
  Timer,
  Zap,
  Star,
  Download,
  Share2
} from 'lucide-react';
import { resultsApi, LeaderboardEntry } from '@/lib/api/results-certs.api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WidgetErrorBoundary } from '@/components/shared/WidgetErrorBoundary';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export default function PublicLeaderboardPage() {
  const { slug } = useParams() as { slug: string };
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  // We need to get the contest ID from the slug. 
  // For now, assuming the API might support slug or we have a way to resolve it.
  // In our current structure, usually we fetch contest details by slug first.
  // Using a placeholder 'slug' for the ID if the API supports it, or I should fetch contest info.
  const { data: leaderboardData, isLoading, error } = useQuery({
    queryKey: ['public-leaderboard', slug, { page }],
    queryFn: () => resultsApi.getPublicLeaderboard(slug, { page, limit: 50 }),
    retry: false, // If 404, results not declared
  });

  const leaderboard = leaderboardData?.data;
  const entries = leaderboard?.entries || [];

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="h-24 w-24 rounded-full bg-secondary flex items-center justify-center mb-6">
          <Trophy className="h-12 w-12 text-muted-foreground opacity-20" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Results Not Declared</h1>
        <p className="text-muted-foreground max-w-md">
          The official leaderboard for this contest has not been published yet. Please check back later.
        </p>
        <Button variant="ghost" className="mt-8 rounded-xl" onClick={() => router.back()}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const topThree = entries.slice(0, 3);
  const remaining = entries.slice(3);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Hero Header */}
      <div className="bg-primary/5 border-b border-primary/10 pt-12 pb-24 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-5 pointer-events-none">
          <div className="absolute top-10 left-10 h-64 w-64 rounded-full bg-primary blur-[120px]" />
          <div className="absolute bottom-10 right-10 h-64 w-64 rounded-full bg-primary blur-[120px]" />
        </div>

        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 relative z-10">
          <div className="space-y-4 text-center md:text-left">
            <Badge className="bg-primary/10 text-primary border-none px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest">
              Final Standings
            </Badge>
            <h1 className="text-4xl md:text-5xl font-black tracking-tight">{leaderboard?.contestTitle || 'Contest Leaderboard'}</h1>
            <p className="text-muted-foreground text-lg font-medium max-w-xl">
              Celebrating the brilliance and hard work of our top performers. Congratulations to everyone!
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="rounded-2xl h-14 px-8 border-border/50 bg-background/50 backdrop-blur-xl">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            <Button className="rounded-2xl h-14 px-8 bg-primary shadow-xl shadow-primary/20">
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 -mt-12 relative z-20 space-y-12">
        <WidgetErrorBoundary name="Leaderboard Podium">
          {/* Podium Section */}
          {entries.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              {/* Rank 2 */}
              {topThree[1] && (
                <Card className="order-2 md:order-1 bg-background/80 backdrop-blur-xl border-border/50 rounded-[2.5rem] shadow-xl overflow-hidden hover:scale-[1.02] transition-all group">
                  <CardContent className="p-8 pt-12 text-center relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 rounded-2xl bg-slate-200 flex items-center justify-center rotate-12 group-hover:rotate-0 transition-transform shadow-lg border-4 border-background">
                      <Medal className="h-8 w-8 text-slate-500" />
                    </div>
                    <p className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-4">Silver Medalist</p>
                    <h3 className="text-2xl font-black mb-1">{topThree[1].participant.contact.firstName} {topThree[1].participant.contact.lastName}</h3>
                    <p className="text-sm text-muted-foreground font-mono mb-6">{topThree[1].participant.registrationRef}</p>
                    
                    <div className="grid grid-cols-2 gap-4 p-4 rounded-3xl bg-slate-50 border border-slate-100">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Score</p>
                        <p className="text-lg font-black">{topThree[1].score}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Accuracy</p>
                        <p className="text-lg font-black">{topThree[1].percentage}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rank 1 */}
              {topThree[0] && (
                <Card className="order-1 md:order-2 bg-background/80 backdrop-blur-xl border-primary/20 rounded-[3rem] shadow-2xl overflow-hidden md:-mt-8 scale-105 hover:scale-[1.07] transition-all group ring-4 ring-primary/5">
                  <CardContent className="p-10 pt-16 text-center relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-3xl bg-primary flex items-center justify-center -rotate-12 group-hover:rotate-0 transition-transform shadow-2xl border-8 border-background">
                      <Crown className="h-10 w-10 text-primary-foreground" />
                    </div>
                    <p className="text-xs font-black text-primary uppercase tracking-[0.3em] mb-4 flex items-center justify-center gap-2">
                      <Star className="h-3 w-3 fill-primary" /> Champion <Star className="h-3 w-3 fill-primary" />
                    </p>
                    <h3 className="text-3xl font-black mb-1">{topThree[0].participant.contact.firstName} {topThree[0].participant.contact.lastName}</h3>
                    <p className="text-sm text-muted-foreground font-mono mb-8">{topThree[0].participant.registrationRef}</p>
                    
                    <div className="grid grid-cols-2 gap-4 p-6 rounded-[2rem] bg-primary/5 border border-primary/10">
                      <div>
                        <p className="text-[10px] text-primary/70 uppercase font-bold tracking-wider">Total Score</p>
                        <p className="text-2xl font-black text-primary">{topThree[0].score}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-primary/70 uppercase font-bold tracking-wider">Accuracy</p>
                        <p className="text-2xl font-black text-primary">{topThree[0].percentage}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rank 3 */}
              {topThree[2] && (
                <Card className="order-3 bg-background/80 backdrop-blur-xl border-border/50 rounded-[2.5rem] shadow-xl overflow-hidden hover:scale-[1.02] transition-all group">
                  <CardContent className="p-8 pt-12 text-center relative">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 h-16 w-16 rounded-2xl bg-amber-100 flex items-center justify-center -rotate-12 group-hover:rotate-0 transition-transform shadow-lg border-4 border-background">
                      <Medal className="h-8 w-8 text-amber-600" />
                    </div>
                    <p className="text-xs font-black text-amber-600 uppercase tracking-[0.2em] mb-4">Bronze Medalist</p>
                    <h3 className="text-2xl font-black mb-1">{topThree[2].participant.contact.firstName} {topThree[2].participant.contact.lastName}</h3>
                    <p className="text-sm text-muted-foreground font-mono mb-6">{topThree[2].participant.registrationRef}</p>
                    
                    <div className="grid grid-cols-2 gap-4 p-4 rounded-3xl bg-amber-50/30 border border-amber-100">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Score</p>
                        <p className="text-lg font-black">{topThree[2].score}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Accuracy</p>
                        <p className="text-lg font-black">{topThree[2].percentage}%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </WidgetErrorBoundary>

        {/* Main Table Section */}
        <WidgetErrorBoundary name="Rankings Table">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <h2 className="text-2xl font-black flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-secondary flex items-center justify-center">
                  <Medal className="h-5 w-5 text-muted-foreground" />
                </div>
                All Rankings
              </h2>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search participant..." 
                  className="pl-12 h-12 rounded-2xl bg-secondary/30 border-border/50 focus:bg-background transition-all"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <Card className="bg-background/50 border-border/50 rounded-[2rem] overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow className="hover:bg-transparent border-none">
                    <TableHead className="font-bold h-14 pl-8">Rank</TableHead>
                    <TableHead className="font-bold">Participant</TableHead>
                    <TableHead className="font-bold text-center">Score</TableHead>
                    <TableHead className="font-bold text-center">Timing</TableHead>
                    <TableHead className="font-bold text-center">Accuracy</TableHead>
                    <TableHead className="font-bold text-right pr-8">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="animate-pulse border-border/20">
                        <TableCell colSpan={6} className="h-16 bg-secondary/5" />
                      </TableRow>
                    ))
                  ) : remaining.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-32 text-center text-muted-foreground italic">
                        No more rankings to show.
                      </TableCell>
                    </TableRow>
                  ) : (
                    remaining.map((entry) => (
                      <TableRow key={entry.participant.registrationRef} className="hover:bg-secondary/10 transition-colors border-border/20 group">
                        <TableCell className="pl-8">
                          <span className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center text-xs font-black">
                            {entry.rank}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/5 flex items-center justify-center text-[10px] font-black text-primary">
                              {entry.participant.contact.firstName[0]}{entry.participant.contact.lastName[0]}
                            </div>
                            <div>
                              <p className="font-bold text-sm leading-none mb-1">
                                {entry.participant.contact.firstName} {entry.participant.contact.lastName}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {entry.participant.registrationRef}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-black">{entry.score}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                              <Timer className="h-3 w-3" /> {Math.floor(entry.timeTakenSecs / 60)}m {entry.timeTakenSecs % 60}s
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-12 h-1 rounded-full bg-secondary overflow-hidden">
                              <div 
                                className="h-full bg-primary transition-all duration-1000" 
                                style={{ width: `${entry.percentage}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold">{entry.percentage}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right pr-8">
                          <Badge variant="secondary" className="rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest bg-secondary/50 text-muted-foreground border-none">
                            Rank {entry.rank}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}
