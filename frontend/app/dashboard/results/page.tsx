'use client';

import Link from 'next/link';
import { Trophy, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useResults } from '@/lib/hooks/useResults';

const PARTICIPANT_ID = 'QZCP12345ABC';

export default function ResultsPage() {
  const { results, loading } = useResults('all');

  const participantResults = results.filter(r => r.participantId === PARTICIPANT_ID);

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Results</h1>
        <p className="text-muted-foreground">Review your quiz performance and detailed scores</p>
      </div>

      {participantResults.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">No results yet. Complete a contest to see your results here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {participantResults.map((result) => (
            <Card key={result.attemptId} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{result.contestId}</CardTitle>
                    <CardDescription>
                      Submitted on {new Date(result.contestId).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge variant={result.isPassed ? 'default' : 'secondary'}>
                    {result.isPassed ? 'Passed' : 'Not Passed'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Score Overview */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Trophy className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                    <p className="text-2xl font-bold">{result.score}</p>
                    <p className="text-xs text-muted-foreground">Score</p>
                  </div>

                  <div className="text-center p-3 bg-muted rounded-lg">
                    <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <p className="text-2xl font-bold">#{result.rank}</p>
                    <p className="text-xs text-muted-foreground">Rank</p>
                  </div>

                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Users className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                    <p className="text-2xl font-bold">{result.percentile}%</p>
                    <p className="text-xs text-muted-foreground">Percentile</p>
                  </div>

                  <div className="text-center p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{result.timeTaken}</p>
                    <p className="text-xs text-muted-foreground">Time Taken</p>
                  </div>
                </div>

                {/* Question Breakdown */}
                <div>
                  <h4 className="font-medium mb-3">Performance Breakdown</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Correct</p>
                      <p className="text-2xl font-bold text-green-600">{result.correctAnswers}</p>
                    </div>
                    <div className="p-3 bg-red-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Wrong</p>
                      <p className="text-2xl font-bold text-red-600">{result.wrongAnswers}</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-muted-foreground">Unattempted</p>
                      <p className="text-2xl font-bold text-gray-600">{result.unattempted}</p>
                    </div>
                  </div>
                </div>

                {/* View Details Button */}
                <Link href={`/results/${result.contestId}`}>
                  <Button className="w-full" variant="outline">
                    View Detailed Analysis
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
